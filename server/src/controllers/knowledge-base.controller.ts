import type { Request, Response } from 'express';
import knowledgeBaseService, { KnowledgeBaseError } from '../services/knowledge-base.service.js';
import whatsappAiService from '../services/whatsapp-ai.service.js';
import { KB_LOW_CONFIDENCE } from '../constants/knowledge-base.js';

// Staff-fixable validation problems (too long, too many rules) are 400s with a message for the form.
const fail = (res: Response, err: any) =>
    res.status(err instanceof KnowledgeBaseError ? 400 : 500).json({ success: false, message: err.message });

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
        const chunk = await knowledgeBaseService.createChunk(text.trim(), source?.trim() || undefined, req.user?.name);
        return res.status(201).json({ success: true, data: chunk });
    } catch (err: any) {
        return fail(res, err);
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
        return fail(res, err);
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

// Runs the real AI on a question without saving anything, and shows what it read —
// so staff can check the knowledge base is being used and tune it.
async function testAnswer(req: Request, res: Response) {
    try {
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
        if (!message || message.length > 500) {
            return res.status(400).json({ success: false, message: 'message is required (max 500 characters)' });
        }
        const ai = await whatsappAiService.processWhatsAppMessage(message, [], { recordGaps: false });
        return res.status(200).json({
            success: true,
            data: {
                reply: ai.reply,
                escalate: ai.escalate,
                escalateReason: ai.escalateReason ?? null,
                lowConfidence: knowledgeBaseService.isLowConfidence(ai.matches),
                lowConfidenceBelow: KB_LOW_CONFIDENCE,
                matches: ai.matches.map((m) => ({ id: m.id, text: m.text, source: m.source, score: m.score })),
            },
        });
    } catch (err: any) {
        return fail(res, err);
    }
}

async function listGaps(_req: Request, res: Response) {
    try {
        return res.status(200).json({ success: true, data: await knowledgeBaseService.listGaps() });
    } catch (err: any) {
        return fail(res, err);
    }
}

async function deleteGap(req: Request, res: Response) {
    try {
        await knowledgeBaseService.deleteGap(req.params.id!);
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return fail(res, err);
    }
}

export default { listChunks, createChunk, updateChunk, deleteChunk, testAnswer, listGaps, deleteGap };
