import type { Request, Response } from 'express';
import DesignationServices from '../services/designation.service.js';

const getAllDesignations = async (req: Request, res: Response) => {
    try {
        const { isActive, department, search } = req.query;
        const query: { isActive?: boolean; department?: string; search?: string } = {};

        if (isActive === 'true') query.isActive = true;
        if (isActive === 'false') query.isActive = false;
        if (typeof department === 'string') query.department = department;
        if (typeof search === 'string') query.search = search;

        const userId = req.user?.id;
        const designations = await DesignationServices.getAllDesignations(query, userId);

        return res.status(200).json({
            success: true,
            designations,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const getDesignationById = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Designation ID is required' });
        }
        const designation = await DesignationServices.getDesignationById(id);

        return res.status(200).json({
            success: true,
            designation,
        });
    } catch (error) {
        return res.status(404).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const createDesignation = async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const result = await DesignationServices.createDesignation(body, userId);

        return res.status(201).json({
            success: true,
            message: 'Designation created successfully',
            designation: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const updateDesignation = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Designation ID is required' });
        }
        const body = req.body;

        const result = await DesignationServices.updateDesignation(id, body);

        return res.status(200).json({
            success: true,
            message: 'Designation updated successfully',
            designation: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const toggleDesignationStatus = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Designation ID is required' });
        }
        const result = await DesignationServices.toggleDesignationStatus(id);

        return res.status(200).json({
            success: true,
            message: `Designation marked as ${result.isActive ? 'active' : 'inactive'}`,
            designation: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const deleteDesignation = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Designation ID is required' });
        }
        const result = await DesignationServices.deleteDesignation(id);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const DesignationControllers = {
    getAllDesignations,
    getDesignationById,
    createDesignation,
    updateDesignation,
    toggleDesignationStatus,
    deleteDesignation,
};

export default DesignationControllers;
