import type { Request, Response } from 'express';
import DepartmentServices from '../services/department.service.js';

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
            departments,
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
            department,
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
