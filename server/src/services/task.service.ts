import { Types } from 'mongoose';
import OrderTaskModel, {
    type IOrderTask,
    TaskStatus,
} from '../models/task.model.js';
import { AppError } from '../utils/AppError.js';

const createTask = async (payload: Partial<IOrderTask>) => {
    const task = await OrderTaskModel.create(payload);
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

const getTasksByStaff = async (staffId: string) => {
    return await OrderTaskModel.find({
        assignedTo: staffId,
        status: { $ne: TaskStatus.COMPLETED },
    })
        .populate('orderId', 'orderNumber status quotationSnapshot.clientName')
        .sort({ dueDate: 1 });
};

const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    const task = await OrderTaskModel.findById(taskId);
    if (!task) {
        throw new AppError('Task not found', 404);
    }

    task.status = status;
    await task.save();
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

    task.status = TaskStatus.UNDER_REVIEW;
    task.submissionNote = payload.note;
    if (payload.attachment) {
        task.submissionAttachment = payload.attachment;
    }
    task.submittedAt = new Date();

    await task.save();
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
    return task;
};

const deleteTask = async (taskId: string) => {
    return await OrderTaskModel.findByIdAndDelete(taskId);
};

const TaskService = {
    createTask,
    getTasksByOrder,
    getTasksByStaff,
    updateTaskStatus,
    submitTask,
    reviewTask,
    deleteTask,
};

export default TaskService;
