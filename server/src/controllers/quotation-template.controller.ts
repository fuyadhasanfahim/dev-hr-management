import type { Request, Response, NextFunction } from 'express';
import QuotationTemplateModel from '../models/quotation-template.model.js';

const createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) return next(new Error('Unauthorized'));
        const { name, ...templateData } = req.body;
        if (!name) return next(new Error('Template name is required'));

        const details = templateData.details || {};
        if (!details.title) {
            details.title = name;
        }

        const newTemplate = await QuotationTemplateModel.create({
            name,
            ...templateData,
            details,
            createdBy: userId,
        });
        res.status(201).json({ success: true, message: 'Template created successfully', data: newTemplate });
    } catch (err) {
        next(err);
    }
};

const getAllTemplates = async (_req: Request, res: Response, _next: NextFunction) => {
    try {
        const templates = await QuotationTemplateModel.find().lean().sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: templates });
    } catch (err: any) {
        console.error("GET ALL TEMPLATES ERROR:", err);
        return res.status(500).json({ success: false, message: err?.message || 'Error fetching templates', error: err });
    }
};

const deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('ID is required'));
        await QuotationTemplateModel.findByIdAndDelete(id);
        return res.status(200).json({ success: true, message: 'Template deleted successfully' });
    } catch (err) {
        next(err);
    }
};

const getTemplateById = async (req: Request, res: Response, _next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, message: 'ID is required' });
        const template = await QuotationTemplateModel.findById(id).lean();
        if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
        return res.status(200).json({ success: true, data: template });
    } catch (err: any) {
        console.error("GET TEMPLATE BY ID ERROR:", err);
        return res.status(500).json({ success: false, message: err?.message || 'Error fetching template', error: err });
    }
};

const updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('ID is required'));

        const updateData = { ...req.body };
        if (updateData.name && (!updateData.details || !updateData.details.title)) {
            updateData.details = updateData.details || {};
            updateData.details.title = updateData.name;
        }

        const updated = await QuotationTemplateModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
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
