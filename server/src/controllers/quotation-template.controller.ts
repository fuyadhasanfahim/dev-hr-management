import type { Request, Response, NextFunction } from 'express';
import QuotationTemplateModel from '../models/quotation-template.model.js';

const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) return next(new Error('Unauthorized'));
        const { name, ...templateData } = req.body;
        if (!name) return next(new Error('Template name is required'));
        const newTemplate = await QuotationTemplateModel.create({
            name,
            ...templateData,
            createdBy: userId,
        });
        res.status(201).json({ success: true, message: 'Template created successfully', data: newTemplate });
    } catch (err) {
        next(err);
    }
};

const getAllTemplates = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const templates = await QuotationTemplateModel.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: templates });
    } catch (err) {
        next(err);
    }
};

const deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('ID is required'));
        await QuotationTemplateModel.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: 'Template deleted successfully' });
    } catch (err) {
        next(err);
    }
};

const getTemplateById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('ID is required'));
        const template = await QuotationTemplateModel.findById(id);
        if (!template) return next(new Error('Template not found'));
        res.status(200).json({ success: true, data: template });
    } catch (err) {
        next(err);
    }
};

const updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('ID is required'));
        const updated = await QuotationTemplateModel.findByIdAndUpdate(id, req.body, { new: true });
        if (!updated) return next(new Error('Template not found'));
        res.status(200).json({ success: true, message: 'Template updated successfully', data: updated });
    } catch (err) {
        next(err);
    }
};

export default {
    createTemplate,
    getAllTemplates,
    deleteTemplate,
    getTemplateById,
    updateTemplate,
};
