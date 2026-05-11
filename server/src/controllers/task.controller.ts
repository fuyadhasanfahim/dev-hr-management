import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import TaskService from '../services/task.service.js';
import StaffModel from '../models/staff.model.js';

async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = req.user;
        if (!user || !user.id) {
            throw new AppError('User context not available', 401);
        }

        const payload = {
            ...req.body,
            assignedBy: user.id,
        };

        const result = await TaskService.createTask(payload);

        res.status(201).json({
            success: true,
            message: 'Task assigned successfully',
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

async function getOrderTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { orderId } = req.params;
        if (!orderId) {
            throw new AppError('Order ID is required', 400);
        }

        const result = await TaskService.getTasksByOrder(orderId);

        res.status(200).json({
            success: true,
            message: 'Tasks fetched successfully',
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

async function getMyTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = req.user;
        if (!user || !user.id) {
            throw new AppError('User context not available', 401);
        }

        // Resolve user to staff first
        const staff = await StaffModel.findOne({ user: user.id });
        if (!staff) {
            throw new AppError('Staff record not found for logged user', 404);
        }

        const result = await TaskService.getTasksByStaff(staff._id.toString());

        res.status(200).json({
            success: true,
            message: 'Your tasks fetched successfully',
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

async function submitTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { taskId } = req.params;
        const user = req.user;

        if (!taskId) {
            throw new AppError('Task ID is required', 400);
        }
        if (!user || !user.id) {
            throw new AppError('User context not available', 401);
        }

        const staff = await StaffModel.findOne({ user: user.id });
        if (!staff) {
            throw new AppError('Unauthorized: staff profile required', 403);
        }

        const result = await TaskService.submitTask(taskId, staff._id.toString(), req.body);

        res.status(200).json({
            success: true,
            message: 'Task submitted for review',
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

async function reviewTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { taskId } = req.params;
        const user = req.user;

        if (!taskId) {
            throw new AppError('Task ID is required', 400);
        }
        if (!user || !user.id) {
            throw new AppError('User context not available', 401);
        }

        const result = await TaskService.reviewTask(taskId, user.id, req.body);

        res.status(200).json({
            success: true,
            message: 'Task review recorded',
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

async function deleteTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { taskId } = req.params;
        if (!taskId) {
            throw new AppError('Task ID is required', 400);
        }

        await TaskService.deleteTask(taskId);

        res.status(200).json({
            success: true,
            message: 'Task deleted successfully',
            data: null,
        });
    } catch (err) {
        next(err);
    }
}

export default {
    createTask,
    getOrderTasks,
    getMyTasks,
    submitTask,
    reviewTask,
    deleteTask,
};
