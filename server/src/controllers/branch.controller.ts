import type { Request, Response } from 'express';
import BranchServices from '../services/branch.service.js';

const createBranch = async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: 'Unauthorized' });
        }

        const result = await BranchServices.createBranch(body, userId);

        return res.status(201).json({
            success: true,
            message: 'Branch created successfully',
            data: result,
            branch: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const getAllBranches = async (req: Request, res: Response) => {
    try {
        const { isActive, search } = req.query;
        const query: { isActive?: boolean; search?: string } = {};

        if (isActive === 'true') query.isActive = true;
        if (isActive === 'false') query.isActive = false;
        if (typeof search === 'string') query.search = search;

        const branches = await BranchServices.getAllBranches(query);

        return res.status(200).json({
            success: true,
            branches,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const getBranchById = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Branch ID is required' });
        }
        const branch = await BranchServices.getBranchById(id);

        return res.status(200).json({
            success: true,
            branch,
        });
    } catch (error) {
        return res.status(404).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const updateBranch = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Branch ID is required' });
        }
        const body = req.body;

        const result = await BranchServices.updateBranch(id, body);

        return res.status(200).json({
            success: true,
            message: 'Branch updated successfully',
            branch: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const toggleBranchStatus = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Branch ID is required' });
        }
        const result = await BranchServices.toggleBranchStatus(id);

        return res.status(200).json({
            success: true,
            message: `Branch marked as ${result.isActive ? 'active' : 'inactive'}`,
            branch: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const deleteBranch = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Branch ID is required' });
        }
        const result = await BranchServices.deleteBranch(id);

        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const BranchControllers = {
    createBranch,
    getAllBranches,
    getBranchById,
    updateBranch,
    toggleBranchStatus,
    deleteBranch,
};

export default BranchControllers;
