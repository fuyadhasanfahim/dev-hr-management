import type { Request, Response } from 'express';
import consultationService from '../services/consultation.service.js';
import { logger } from '../lib/logger.js';

async function create(req: Request, res: Response) {
    try {
        const { name, email, phone, projectDescription, projectType, source, chatTranscript } = req.body;

        if (!name || !email || !projectDescription) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and project description are required',
            });
        }

        const consultation = await consultationService.createConsultation({
            name,
            email,
            phone,
            projectDescription,
            projectType,
            source: source || 'ai_chat',
            chatTranscript,
        });

        return res.status(201).json({ success: true, data: consultation });
    } catch (err: any) {
        logger.error(`Create consultation error: ${err.message}`);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

async function getAll(req: Request, res: Response) {
    try {
        const { page, limit, search, status } = req.query;
        const result = await consultationService.getConsultations({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search: search as string,
            status: status as any,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        logger.error(`Get consultations error: ${err.message}`);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

async function getById(req: Request, res: Response) {
    try {
        const consultation = await consultationService.getConsultationById(req.params.id);
        return res.status(200).json({ success: true, data: consultation });
    } catch (err: any) {
        logger.error(`Get consultation error: ${err.message}`);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

async function update(req: Request, res: Response) {
    try {
        const { status, scheduledAt, durationMinutes, adminNotes, assignedTo } = req.body;
        const consultation = await consultationService.updateConsultation(req.params.id, {
            status,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
            durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
            adminNotes,
            assignedTo,
        });

        return res.status(200).json({ success: true, data: consultation });
    } catch (err: any) {
        logger.error(`Update consultation error: ${err.message}`);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

async function remove(req: Request, res: Response) {
    try {
        await consultationService.deleteConsultation(req.params.id);
        return res.status(200).json({ success: true, message: 'Consultation deleted' });
    } catch (err: any) {
        logger.error(`Delete consultation error: ${err.message}`);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

async function getStats(req: Request, res: Response) {
    try {
        const stats = await consultationService.getStats();
        return res.status(200).json({ success: true, data: stats });
    } catch (err: any) {
        logger.error(`Consultation stats error: ${err.message}`);
        return res.status(500).json({ success: false, message: err.message });
    }
}

export default {
    create,
    getAll,
    getById,
    update,
    remove,
    getStats,
};
