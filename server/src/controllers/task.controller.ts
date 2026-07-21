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

        const isManager = ['admin', 'super_admin', 'hr_manager', 'team_leader'].includes(user.role as string);

        if (isManager) {
            // Managers see all tasks across all active orders so they can manage the Kanban board
            const result = await TaskService.getAllTasks();
            res.status(200).json({
                success: true,
                message: 'All tasks fetched successfully',
                data: result,
            });
            return;
        }

        const staff = await StaffModel.findOne({ userId: user.id });

        const result = await TaskService.getTasksByStaff(staff?._id?.toString(), user.id);

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

        const isManager = ['admin', 'super_admin', 'hr_manager', 'team_leader'].includes(user.role as string);
        const staff = await StaffModel.findOne({ userId: user.id });
        
        if (!isManager && !staff) {
            throw new AppError('Unauthorized: staff profile required', 403);
        }

        // Pass bounding staffId constraint ONLY if actor is NOT a manager.
        const actorStaffConstraint = isManager ? undefined : staff?._id?.toString();
        const result = await TaskService.submitTask(taskId, req.body, actorStaffConstraint);

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

async function updateTaskStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        const user = req.user;

        if (!taskId) throw new AppError('Task ID is required', 400);
        if (!status) throw new AppError('Status is required', 400);
        if (!user || !user.id) throw new AppError('User context not available', 401);

        // Resolve to staff (for staff-level actors)
        const staff = await StaffModel.findOne({ userId: user.id });

        // Allowed staff transitions: pending→in_progress, rejected→in_progress
        const STAFF_ALLOWED: Record<string, string[]> = {
            pending: ['in_progress'],
            rejected: ['in_progress'],
            in_progress: ['in_progress'], // idempotent
        };

        // Admin/lead can force any status
        const isManager = ['admin', 'super_admin', 'hr_manager', 'team_leader'].includes(user.role as string);

        if (!isManager && staff) {
            const allowed = STAFF_ALLOWED[req.body.currentStatus ?? ''] ?? [];
            if (!allowed.includes(status)) {
                throw new AppError(`You cannot change task status to "${status}" from its current state.`, 403);
            }
        }

        // Non-managers can only update tasks assigned to them
        const staffConstraint = isManager ? undefined : staff?._id?.toString();
        const result = await TaskService.updateTaskStatus(taskId, status, user.id, staffConstraint);

        res.status(200).json({
            success: true,
            message: 'Task status updated',
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { taskId } = req.params;
        const user = req.user;

        if (!taskId) {
            throw new AppError('Task ID is required', 400);
        }
        if (!user || !user.id) {
            throw new AppError('User context not available', 401);
        }

        const result = await TaskService.updateTask(taskId, req.body, user.id);

        res.status(200).json({
            success: true,
            message: 'Task updated successfully',
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
    updateTask,
    updateTaskStatus,
    deleteTask,
};
