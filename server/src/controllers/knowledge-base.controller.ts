import type { Request, Response } from 'express';
import knowledgeBaseService from '../services/knowledge-base.service.js';

async function listChunks(_req: Request, res: Response) {
    try {
        const chunks = await knowledgeBaseService.listChunks();
        return res.status(200).json({ success: true, data: chunks });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function createChunk(req: Request, res: Response) {
    try {
        const { text, source } = req.body;
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, message: 'text is required' });
        }
        const chunk = await knowledgeBaseService.createChunk(text.trim(), source?.trim() || undefined);
        return res.status(201).json({ success: true, data: chunk });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function updateChunk(req: Request, res: Response) {
    try {
        const { text, source } = req.body;
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, message: 'text is required' });
        }
        const chunk = await knowledgeBaseService.updateChunk(req.params.id!, text.trim(), source?.trim() || undefined);
        return res.status(200).json({ success: true, data: chunk });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function deleteChunk(req: Request, res: Response) {
    try {
        await knowledgeBaseService.deleteChunk(req.params.id!);
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

export default { listChunks, createChunk, updateChunk, deleteChunk };
