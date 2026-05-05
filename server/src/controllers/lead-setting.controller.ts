import type { Request, Response } from 'express';
import LeadSettingService from '../services/lead-setting.service.js';

const getAllSettings = async (req: Request, res: Response) => {
    try {
        const type = req.query.type as string;
        const result = await LeadSettingService.getAllSettings(type);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error: unknown) {
        const err = error as Error;
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to fetch lead settings',
        });
    }
};

const createSetting = async (req: Request, res: Response) => {
    try {
        const result = await LeadSettingService.createSetting(req.body);
        res.status(201).json({
            success: true,
            message: 'Lead setting created successfully',
            data: result,
        });
    } catch (error: unknown) {
        const err = error as Error;
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to create lead setting',
        });
    }
};

const updateSetting = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) throw new Error('Setting ID is required');
        const result = await LeadSettingService.updateSetting(id, req.body);
        res.status(200).json({
            success: true,
            message: 'Lead setting updated successfully',
            data: result,
        });
    } catch (error: unknown) {
        const err = error as Error;
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to update lead setting',
        });
    }
};

const deleteSetting = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ success: false, message: 'Setting ID is required' });
            return;
        }
        await LeadSettingService.deleteSetting(id);
        res.status(200).json({
            success: true,
            message: 'Lead setting deleted successfully',
        });
    } catch (error: unknown) {
        const err = error as Error;
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to delete lead setting',
        });
    }
};

export default {
    getAllSettings,
    createSetting,
    updateSetting,
    deleteSetting,
};
