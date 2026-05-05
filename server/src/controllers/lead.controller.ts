import type { Request, Response } from 'express';
import LeadService from '../services/lead.service.js';

const getAllLeads = async (req: Request, res: Response) => {
    try {
        const params: any = {
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
            search: req.query.search as string,
            status: req.query.status as string,
            priority: req.query.priority as string,
            source: req.query.source as string,
            assignedTo: req.query.assignedTo as string,
        };

        if (req.query.isConverted !== undefined) {
            params.isConverted = req.query.isConverted === 'true';
        }

        const result = await LeadService.getAllLeads(params);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error: unknown) {
        const err = error as Error;
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to fetch leads',
        });
    }
};

const getLeadById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await LeadService.getLeadById(id as string);
        if (!result) {
            res.status(404).json({
                success: false,
                message: 'Lead not found',
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error: unknown) {
        const err = error as Error;
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to fetch lead',
        });
    }
};

const createLead = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) throw new Error('Unauthorized');

        const result = await LeadService.createLead(req.body, userId);
        res.status(201).json({
            success: true,
            message: 'Lead created successfully',
            data: result,
        });
    } catch (error: any) {
        if (error.name === 'DuplicatePhoneError') {
            res.status(400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create lead',
        });
    }
};

const updateLead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await LeadService.updateLead(id as string, req.body);
        res.status(200).json({
            success: true,
            message: 'Lead updated successfully',
            data: result,
        });
    } catch (error: any) {
        if (error.name === 'DuplicatePhoneError') {
            res.status(400).json({
                success: false,
                message: error.message,
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update lead',
        });
    }
};

const addActivity = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) throw new Error('Unauthorized');

        const result = await LeadService.addActivity(
            id as string,
            req.body,
            userId,
        );
        res.status(201).json({
            success: true,
            message: 'Activity added successfully',
            data: result,
        });
    } catch (error: unknown) {
        const err = error as Error;
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to add activity',
        });
    }
};

const convertToClient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) throw new Error('Unauthorized');

        const result = await LeadService.convertToClient(
            id as string,
            req.body,
            userId,
        );
        res.status(200).json({
            success: true,
            message: 'Lead converted to client successfully',
            data: result,
        });
    } catch (error: unknown) {
        const err = error as Error;
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to convert lead',
        });
    }
};

export default {
    getAllLeads,
    getLeadById,
    createLead,
    updateLead,
    addActivity,
    convertToClient,
};
