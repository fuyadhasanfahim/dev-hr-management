import { Types } from 'mongoose';
import OrderTaskModel, {
    type IOrderTask,
    TaskStatus,
} from '../models/task.model.js';
import { AppError } from '../utils/AppError.js';
import notificationService from './notification.service.js';
import { logger } from '../lib/logger.js';

const createTask = async (payload: Partial<IOrderTask>) => {
    const task = await OrderTaskModel.create(payload);

    // Background notification broadcast
    (async () => {
        try {
            const populated = await OrderTaskModel.findById(task._id)
                .populate({ path: 'assignedTo', select: 'userId' })
                .populate({ path: 'orderId', select: 'orderNumber' });

            if (populated?.assignedTo && (populated.assignedTo as any).userId) {
                await notificationService.notifyTaskAssigned({
                    userId: (populated.assignedTo as any).userId,
                    taskId: task._id as any,
                    taskTitle: task.title,
                    assignedBy: task.assignedBy,
                    ...((populated.orderId as any)?.orderNumber ? { orderNumber: (populated.orderId as any).orderNumber } : {}),
                });
            }
        } catch (err) {
            logger.error({ err, taskId: task._id }, 'Failed to broadcast task assignment notification');
        }
    })();

    return task;
};

const getTasksByOrder = async (orderId: string) => {
    return await OrderTaskModel.find({ orderId })
        .populate({
            path: 'assignedTo',
            select: 'userId designation avatar',
            populate: {
                path: 'userId',
                model: 'User',
                select: 'name email image',
            },
        })
        .populate('assignedBy', 'name')
        .sort({ dueDate: 1 });
};

const getAllTasks = async () => {
    return await OrderTaskModel.find({})
        .populate({
            path: 'assignedTo',
            select: 'userId designation avatar',
            populate: {
                path: 'userId',
                model: 'User',
                select: 'name email image',
            },
        })
        .populate('orderId', 'orderNumber status quotationSnapshot.clientName')
        .sort({ dueDate: 1 });
};

const getTasksByStaff = async (staffId?: string, userId?: string) => {
    const orConditions: any[] = [];

    if (staffId) {
        orConditions.push({ assignedTo: staffId });
        if (Types.ObjectId.isValid(staffId)) {
            orConditions.push({ assignedTo: new Types.ObjectId(staffId) });
        }
    }

    if (userId) {
        orConditions.push({ assignedTo: userId });
        if (Types.ObjectId.isValid(userId)) {
            orConditions.push({ assignedTo: new Types.ObjectId(userId) });
        }
    }

    const filter = orConditions.length > 0 ? { $or: orConditions } : {};

    return await OrderTaskModel.find(filter)
        .populate({
            path: 'assignedTo',
            select: 'userId designation avatar',
            populate: {
                path: 'userId',
                model: 'User',
                select: 'name email image',
            },
        })
        .populate('orderId', 'orderNumber status quotationSnapshot.clientName')
        .sort({ dueDate: 1 });
};

const updateTaskStatus = async (taskId: string, status: TaskStatus, actorId?: string, staffConstraint?: string) => {
    const query: any = { _id: taskId };
    if (staffConstraint) query.assignedTo = staffConstraint;

    const task = await OrderTaskModel.findOne(query);
    if (!task) {
        throw new AppError(staffConstraint ? 'Assigned task not found.' : 'Task not found', 404);
    }

    const oldStatus = task.status;
    task.status = status;
    await task.save();

    // Background notification about random status changes
    if (oldStatus !== status) {
        (async () => {
            try {
                const populated = await OrderTaskModel.findById(task._id)
                    .populate({ path: 'assignedTo', select: 'userId' })
                    .populate({ path: 'orderId', select: 'orderNumber' });

                if (populated) {
                    const userIdToNotify = actorId?.toString() === task.assignedBy.toString()
                        ? (populated.assignedTo as any).userId // Manager changed it, notify Staff
                        : task.assignedBy; // Staff changed it, notify Manager

                    if (userIdToNotify) {
                        const isManagerToNotify = actorId?.toString() !== task.assignedBy.toString();
                        const actionUrl = isManagerToNotify && populated.orderId 
                            ? `/orders/${(populated.orderId as any)._id}?tab=tasks` 
                            : "/tasks";

                        await notificationService.notifyTaskActivity({
                            userId: userIdToNotify,
                            taskId: task._id as any,
                            title: `🔄 Milestone Status Updated`,
                            message: `"${task.title}" moved from ${oldStatus} to ${status}.`,
                            actionUrl,
                            ...(actorId ? { createdBy: new Types.ObjectId(actorId) } : {}),
                        });
                    }
                }
            } catch (err) {
                 logger.error({ err, taskId: task._id }, 'Failed to broadcast status change notification');
            }
        })();
    }

    return task;
};

const submitTask = async (
    taskId: string,
    payload: { note: string; attachment?: string },
    actorStaffId?: string,
) => {
    const query: any = { _id: taskId };
    if (actorStaffId) {
        query.assignedTo = actorStaffId;
    }

    const task = await OrderTaskModel.findOne(query);
    if (!task) {
        throw new AppError(actorStaffId ? 'Assigned task not found.' : 'Task not found.', 404);
    }

    if (task.status !== TaskStatus.IN_PROGRESS) {
        throw new AppError('Task must be in progress before submitting deliverables.', 400);
    }

    task.status = TaskStatus.UNDER_REVIEW;
    task.submissionNote = payload.note;
    if (payload.attachment) {
        task.submissionAttachment = payload.attachment;
    }
    task.submittedAt = new Date();

    await task.save();

    // Background broadcast to Management/Admins
    (async () => {
        try {
            const populated = await OrderTaskModel.findById(task._id)
                .populate({ path: 'assignedTo', select: 'userId', populate: { path: 'userId', select: 'name' } })
                .populate({ path: 'orderId', select: 'orderNumber' });

            if (populated) {
                const staffUser = (populated.assignedTo as any)?.userId;
                const order = populated.orderId as any;
                
                await notificationService.notifyAdminsTaskReview({
                    taskId: task._id as any,
                    taskTitle: task.title,
                    staffName: staffUser?.name || 'Team Member',
                    ...(order?.orderNumber ? { orderNumber: order.orderNumber } : {}),
                    ...(order?._id ? { orderId: order._id } : {}),
                    ...(staffUser?._id ? { submittedBy: staffUser._id } : {}),
                });
            }
        } catch (err) {
            logger.error({ err, taskId: task._id }, 'Failed to broadcast review request notification');
        }
    })();

    return task;
};

const reviewTask = async (
    taskId: string,
    reviewerId: string,
    payload: { decision: 'approve' | 'reject'; note?: string },
) => {
    const task = await OrderTaskModel.findById(taskId);
    if (!task) {
        throw new AppError('Task not found.', 404);
    }

    task.status =
        payload.decision === 'approve'
            ? TaskStatus.COMPLETED
            : TaskStatus.REJECTED;
    task.reviewNote = payload.note!;
    task.reviewedBy = new Types.ObjectId(reviewerId);
    task.reviewedAt = new Date();

    await task.save();

    // Background notify the assigned staff member
    (async () => {
        try {
            const populated = await OrderTaskModel.findById(task._id)
                .populate({ path: 'assignedTo', select: 'userId' });
            
            const targetStaffUserId = (populated?.assignedTo as any)?.userId;
            
            if (targetStaffUserId) {
                await notificationService.notifyStaffTaskReviewed({
                    userId: targetStaffUserId,
                    taskId: task._id as any,
                    taskTitle: task.title,
                    decision: payload.decision,
                    reviewedBy: new Types.ObjectId(reviewerId),
                    ...(payload.note ? { note: payload.note } : {}),
                });
            }
        } catch (err) {
            logger.error({ err, taskId: task._id }, 'Failed to broadcast review result notification');
        }
    })();

    return task;
};

const deleteTask = async (taskId: string) => {
    return await OrderTaskModel.findByIdAndDelete(taskId);
};

const updateTask = async (taskId: string, payload: any, actorId?: string) => {
    const oldTask = await OrderTaskModel.findById(taskId);
    if (!oldTask) throw new Error('Task not found');

    const updatedTask = await OrderTaskModel.findByIdAndUpdate(
        taskId,
        { $set: payload },
        { new: true }
    );

    if (!updatedTask) throw new Error('Failed to update task');

    // Logic: Notify staff if task details significantly change
    (async () => {
        try {
            const targetStaffUserId = await (async () => {
                const { default: StaffModel } = await import("../models/staff.model.js");
                const staff = await StaffModel.findById(updatedTask.assignedTo);
                return staff?.userId;
            })();

            if (targetStaffUserId) {
                const isAssignmentChange = oldTask.assignedTo?.toString() !== updatedTask.assignedTo?.toString();
                
                await notificationService.notifyTaskActivity({
                    userId: targetStaffUserId,
                    taskId: updatedTask._id as any,
                    title: isAssignmentChange ? "📌 Reassigned Milestone" : "✏️ Milestone Updated",
                    message: isAssignmentChange 
                        ? `You have been newly assigned to: "${updatedTask.title}".`
                        : `Details for milestone "${updatedTask.title}" were amended by management.`,
                    actionUrl: "/tasks",
                    ...(actorId ? { createdBy: new Types.ObjectId(actorId) } : {}),
                });
            }
        } catch (err) {
            logger.error({ err, taskId: updatedTask._id }, 'Failed to broadcast task amendment notification');
        }
    })();

    return updatedTask;
};

const TaskService = {
    createTask,
    getAllTasks,
    getTasksByOrder,
    getTasksByStaff,
    updateTask,
    updateTaskStatus,
    submitTask,
    reviewTask,
    deleteTask,
};

export default TaskService;
