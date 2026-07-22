import NotificationModel from "../models/notification.model.js";
import { Types } from "mongoose";
import { emitToUser } from "../socket.js";

// Create a notification for a single user
const createNotification = async (data: {
    userId: Types.ObjectId | string;
    title: string;
    message: string;
    type:

        | "leave"
        | "attendance"
        | "shift"
        | "announcement"
        | "earning"
        | "task";
    priority?: "low" | "medium" | "high" | "urgent";
    resourceType?:

        | "leave"
        | "staff"
        | "attendance"
        | "shift"
        | "earning"
        | "task";
    resourceId?: Types.ObjectId | string;
    actionUrl?: string;
    actionLabel?: string;
    createdBy?: Types.ObjectId | string;
    expiresAt?: Date;
}) => {
    const payload: any = {
        userId: new Types.ObjectId(data.userId),
        title: data.title,
        message: data.message,
        type: data.type,
        priority: data.priority || "medium",
        isRead: false,
        expiresAt: data.expiresAt,
    };

    if (data.resourceType) payload.resourceType = data.resourceType;
    if (data.resourceId)
        payload.resourceId = new Types.ObjectId(data.resourceId);
    if (data.actionUrl) payload.actionUrl = data.actionUrl;
    if (data.actionLabel) payload.actionLabel = data.actionLabel;
    if (data.createdBy) payload.createdBy = new Types.ObjectId(data.createdBy);

    const notification = await NotificationModel.create(payload);
    if (data.userId) {
        emitToUser(data.userId.toString(), "notification:new", notification);
    }

    return notification;
};

// Get all notifications for a user
const getUserNotifications = async (
    userId: string,
    filters?: {
        isRead?: boolean;
        type?: string;
        limit?: number;
        skip?: number;
    },
) => {
    const query: any = { userId: new Types.ObjectId(userId) };

    if (filters?.isRead !== undefined) {
        query.isRead = filters.isRead;
    }

    if (filters?.type) {
        query.type = filters.type;
    }

    const notifications = await NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .skip(filters?.skip || 0)
        .limit(filters?.limit || 50)
        .lean();

    return notifications;
};

// Get unread count for a user
const getUnreadCount = async (userId: string) => {
    const count = await NotificationModel.countDocuments({
        userId: new Types.ObjectId(userId),
        isRead: false,
    });

    return count;
};

// Mark notification as read
const markAsRead = async (notificationId: string, userId: string) => {
    const notification = await NotificationModel.findOneAndUpdate(
        {
            _id: new Types.ObjectId(notificationId),
            userId: new Types.ObjectId(userId),
        },
        {
            isRead: true,
            readAt: new Date(),
        },
        { new: true },
    );

    return notification;
};

// Mark all notifications as read for a user
const markAllAsRead = async (userId: string) => {
    const result = await NotificationModel.updateMany(
        {
            userId: new Types.ObjectId(userId),
            isRead: false,
        },
        {
            isRead: true,
            readAt: new Date(),
        },
    );

    return result;
};

// Delete a notification
const deleteNotification = async (notificationId: string, userId: string) => {
    const result = await NotificationModel.deleteOne({
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
    });

    return result;
};

// Delete all notifications for a user
const deleteAllNotifications = async (userId: string) => {
    const result = await NotificationModel.deleteMany({
        userId: new Types.ObjectId(userId),
    });

    return result;
};

// ============================================
// HELPER FUNCTIONS FOR SPECIFIC NOTIFICATIONS
// ============================================



// Notify staff about new shift assignment
const notifyShiftAssignment = async (data: {
    staffUserId: Types.ObjectId | string;
    shiftName: string;
    startDate: string;
    assignedBy: Types.ObjectId | string;
}) => {
    await createNotification({
        userId: data.staffUserId,
        title: "📅 New Shift Assigned",
        message: `You have been assigned to ${data.shiftName} starting from ${data.startDate}`,
        type: "shift",
        priority: "high",
        resourceType: "shift",
        actionUrl: "/my-schedule",
        actionLabel: "View Schedule",
        createdBy: data.assignedBy,
    });
};

// Notify staff about shift change
const notifyShiftChange = async (data: {
    staffUserId: Types.ObjectId | string;
    oldShiftName: string;
    newShiftName: string;
    effectiveDate: string;
    changedBy: Types.ObjectId | string;
}) => {
    await createNotification({
        userId: data.staffUserId,
        title: "🔄 Shift Changed",
        message: `Your shift has been changed from ${data.oldShiftName} to ${data.newShiftName} effective ${data.effectiveDate}`,
        type: "shift",
        priority: "urgent",
        resourceType: "shift",
        actionUrl: "/my-schedule",
        actionLabel: "View Schedule",
        createdBy: data.changedBy,
    });
};



// ============================================
// LEAVE NOTIFICATION HELPERS
// ============================================

// Notify staff about leave status change (approved/rejected/revoked)
const notifyLeaveStatus = async (data: {
    staffUserId: Types.ObjectId | string;
    leaveId: Types.ObjectId | string;
    status: "approved" | "partially_approved" | "rejected" | "revoked";
    leaveType: string;
    startDate: string;
    endDate: string;
    approvedDays?: number;
    approvedBy: Types.ObjectId | string;
    comment?: string;
}) => {
    let title: string;
    let message: string;
    let priority: "low" | "medium" | "high" | "urgent" = "high";

    switch (data.status) {
        case "approved":
            title = "✅ Leave Approved";
            message = `Your ${data.leaveType} leave from ${data.startDate} to ${data.endDate} has been approved`;
            break;
        case "partially_approved":
            title = "✅ Leave Partially Approved";
            message = `Your ${
                data.leaveType
            } leave has been partially approved (${
                data.approvedDays || 0
            } days)`;
            break;
        case "rejected":
            title = "❌ Leave Rejected";
            message = `Your ${data.leaveType} leave from ${data.startDate} to ${data.endDate} has been rejected`;
            if (data.comment) message += `. Reason: ${data.comment}`;
            break;
        case "revoked":
            title = "⚠️ Leave Revoked";
            message = `Your ${data.leaveType} leave from ${data.startDate} to ${data.endDate} has been revoked. Balance has been restored.`;
            priority = "urgent";
            if (data.comment) message += ` Reason: ${data.comment}`;
            break;
        default:
            title = "📋 Leave Update";
            message = `Your ${data.leaveType} leave status has been updated`;
    }

    await createNotification({
        userId: data.staffUserId,
        title,
        message,
        type: "leave",
        priority,
        resourceType: "leave",
        resourceId: data.leaveId,
        actionUrl: "/leave/apply",
        actionLabel: "View Details",
        createdBy: data.approvedBy,
    });
};

// Notify admins about new leave request
const notifyAdminsLeaveRequest = async (data: {
    staffName: string;
    staffUserId: Types.ObjectId | string;
    leaveId: Types.ObjectId | string;
    leaveType: string;
    startDate: string;
    endDate: string;
    days: number;
}) => {
    const { default: UserModel } = await import("../models/user.model.js");

    // UserModel is a native MongoDB collection, not a Mongoose model
    const admins = await UserModel.find({
        role: { $in: ["super_admin", "admin", "hr_manager"] },
    }).toArray();

    const notifications = admins.map((admin: any) => ({
        userId: admin._id,
        title: "📝 Leave Approval Needed",
        message: `${data.staffName} requested ${data.days} days of ${data.leaveType} leave (${data.startDate} - ${data.endDate})`,
        type: "leave" as const,
        priority: "high" as const,
        resourceType: "leave" as const,
        resourceId: data.leaveId,
        actionUrl: "/leave/manage",
        actionLabel: "Review Request",
        createdBy: data.staffUserId,
    }));

    if (notifications.length > 0) {
        const createdDocs = await NotificationModel.insertMany(notifications);
        createdDocs.forEach((doc: any) => {
            if (doc.userId) {
                emitToUser(doc.userId.toString(), "notification:new", doc);
            }
        });
    }
};

// Notify admins about received payment
const notifyAdminsPaymentReceived = async (data: {
    clientName: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    clientUserId: Types.ObjectId | string;
}) => {
    const { default: UserModel } = await import("../models/user.model.js");

    // Get admins to notify
    const admins = await UserModel.find({
        role: { $in: ["super_admin", "admin", "hr_manager", "owner"] },
    }).toArray();

    const notifications = admins.map((admin: any) => ({
        userId: admin._id,
        title: "💰 Payment Received",
        message: `Client ${data.clientName} just paid ${data.amount} ${data.currency} for Invoice #${data.invoiceNumber}. Please convert to BDT.`,
        type: "earning" as const,
        priority: "high" as const,
        resourceType: "earning" as const,
        actionUrl: "/earnings",
        actionLabel: "Convert Now",
        createdBy: data.clientUserId,
    }));

    if (notifications.length > 0) {
        const createdDocs = await NotificationModel.insertMany(notifications);
        createdDocs.forEach((doc: any) => {
            if (doc.userId) {
                emitToUser(doc.userId.toString(), "notification:new", doc);
            }
        });
    }
};

// ============================================
// TASK NOTIFICATION HELPERS
// ============================================

// Notify staff member when a task is assigned to them
const notifyTaskAssigned = async (data: {
    userId: Types.ObjectId | string;
    taskTitle: string;
    orderNumber?: string;
    taskId: Types.ObjectId | string;
    assignedBy: Types.ObjectId | string;
}) => {
    await createNotification({
        userId: data.userId,
        title: "📌 New Milestone Assigned",
        message: `You have been assigned to: "${data.taskTitle}" ${data.orderNumber ? `for Order #${data.orderNumber}` : ''}`,
        type: "task",
        priority: "medium",
        resourceType: "task",
        resourceId: data.taskId,
        actionUrl: "/tasks",
        actionLabel: "View Task",
        createdBy: data.assignedBy,
    });
};

// Notify admins when a staff member submits a task for review
const notifyAdminsTaskReview = async (data: {
    taskId: Types.ObjectId | string;
    taskTitle: string;
    staffName: string;
    orderNumber?: string;
    orderId?: Types.ObjectId | string;
    submittedBy?: Types.ObjectId | string;
}) => {
    const { default: UserModel } = await import("../models/user.model.js");

    // Get target management users
    const management = await UserModel.find({
        role: { $in: ["super_admin", "admin", "hr_manager"] },
    }).toArray();

    const notifications = management.map((user: any) => ({
        userId: user._id,
        title: "🔍 Milestone Review Required",
        message: `${data.staffName} submitted "${data.taskTitle}" ${data.orderNumber ? `(Order #${data.orderNumber})` : ''} for approval.`,
        type: "task" as const,
        priority: "high" as const,
        resourceType: "task" as const,
        resourceId: data.taskId,
        actionUrl: data.orderId ? `/orders/${data.orderId}?tab=tasks` : "/tasks", 
        actionLabel: "Review Milestone",
        ...(data.submittedBy ? { createdBy: data.submittedBy } : {}),
    }));

    if (notifications.length > 0) {
        const createdDocs = await NotificationModel.insertMany(notifications);
        createdDocs.forEach((doc: any) => {
            if (doc.userId) {
                emitToUser(doc.userId.toString(), "notification:new", doc);
            }
        });
    }
};

// Notify staff when their submission is approved/rejected
const notifyStaffTaskReviewed = async (data: {
    userId: Types.ObjectId | string;
    taskId: Types.ObjectId | string;
    taskTitle: string;
    decision: 'approve' | 'reject';
    reviewedBy: Types.ObjectId | string;
    note?: string;
}) => {
    const isApprove = data.decision === 'approve';
    await createNotification({
        userId: data.userId,
        title: isApprove ? "✅ Milestone Approved" : "❌ Milestone Revision Requested",
        message: isApprove 
            ? `Great work! "${data.taskTitle}" has been approved.` 
            : `Revision requested for "${data.taskTitle}". ${data.note || 'Please review the feedback.'}`,
        type: "task",
        priority: isApprove ? "medium" : "high",
        resourceType: "task",
        resourceId: data.taskId,
        actionUrl: "/tasks",
        actionLabel: "View Status",
        createdBy: data.reviewedBy,
    });
};

// Generic helper to notify someone of a specific action on a task
const notifyTaskActivity = async (data: {
    userId: Types.ObjectId | string;
    taskId: Types.ObjectId | string;
    title: string;
    message: string;
    actionUrl?: string;
    createdBy?: Types.ObjectId | string;
}) => {
    await createNotification({
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: "task",
        priority: "medium",
        resourceType: "task",
        resourceId: data.taskId,
        actionUrl: data.actionUrl || "/tasks",
        actionLabel: "View Progress",
        ...(data.createdBy ? { createdBy: data.createdBy } : {}),
    });
};

export default {
    createNotification,
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    // Helper functions

    notifyShiftAssignment,
    notifyShiftChange,

    // Leave helpers
    notifyLeaveStatus,
    notifyAdminsLeaveRequest,
    notifyAdminsPaymentReceived,

    // Task helpers
    notifyTaskAssigned,
    notifyAdminsTaskReview,
    notifyStaffTaskReviewed,
    notifyTaskActivity,
};
