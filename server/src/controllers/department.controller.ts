import type { Request, Response } from 'express';
import DepartmentServices from '../services/department.service.js';
import { userCan } from '../middlewares/require-permission.js';

/**
 * The `permissions` grant array is RBAC configuration, not general metadata —
 * these GET routes are reachable unauthenticated (see the public-metadata
 * allow-list in app.ts), so strip it for anyone without `role.assign`.
 */
function stripGrants(req: Request, doc: unknown): unknown {
    if (userCan(req, 'role.assign')) return doc;
    const plain =
        doc && typeof (doc as { toObject?: unknown }).toObject === 'function'
            ? (doc as { toObject: () => Record<string, unknown> }).toObject()
            : ({ ...(doc as Record<string, unknown>) });
    delete (plain as Record<string, unknown>).permissions;
    return plain;
}

const getAllDepartments = async (req: Request, res: Response) => {
    try {
        const { isActive, search } = req.query;
        const query: { isActive?: boolean; search?: string } = {};

        if (isActive === 'true') query.isActive = true;
        if (isActive === 'false') query.isActive = false;
        if (typeof search === 'string') query.search = search;

        const userId = req.user?.id;
        const departments = await DepartmentServices.getAllDepartments(query, userId);

        return res.status(200).json({
            success: true,
            departments: (departments as unknown[]).map((d) => stripGrants(req, d)),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const getDepartmentById = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Department ID is required' });
        }
        const department = await DepartmentServices.getDepartmentById(id);

        return res.status(200).json({
            success: true,
            department: stripGrants(req, department),
        });
    } catch (error) {
        return res.status(404).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const createDepartment = async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const result = await DepartmentServices.createDepartment(body, userId);

        return res.status(201).json({
            success: true,
            message: 'Department created successfully',
            department: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const updateDepartment = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Department ID is required' });
        }
        const body = req.body;

        const result = await DepartmentServices.updateDepartment(id, body);

        return res.status(200).json({
            success: true,
            message: 'Department updated successfully',
            department: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const toggleDepartmentStatus = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Department ID is required' });
        }
        const result = await DepartmentServices.toggleDepartmentStatus(id);

        return res.status(200).json({
            success: true,
            message: `Department marked as ${result.isActive ? 'active' : 'inactive'}`,
            department: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const deleteDepartment = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Department ID is required' });
        }
        const result = await DepartmentServices.deleteDepartment(id);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const DepartmentControllers = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    toggleDepartmentStatus,
    deleteDepartment,
};

export default DepartmentControllers;
