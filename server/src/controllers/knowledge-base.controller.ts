import type { Request, Response } from 'express';
import knowledgeBaseService, { KnowledgeBaseError } from '../services/knowledge-base.service.js';
import whatsappAiService from '../services/whatsapp-ai.service.js';
import { isSalesStage } from '../lib/sales-flow.js';
import aiLearning from '../services/ai-learning.service.js';
import { KB_LOW_CONFIDENCE, parseKbChannel } from '../constants/knowledge-base.js';
import { likePattern, pageMeta, parsePage } from '../utils/pagination.js';

// Staff-fixable validation problems (too long, too many rules) are 400s with a message for the form.
const fail = (res: Response, err: any) =>
    res.status(err instanceof KnowledgeBaseError ? 400 : 500).json({ success: false, message: err.message });

async function listChunks(req: Request, res: Response) {
    try {
        const p = parsePage(req.query);
        const { items, total } = await knowledgeBaseService.listChunks({ like: likePattern(req.query.q), limit: p.limit, offset: p.offset });
        return res.status(200).json({ success: true, data: items, meta: pageMeta(p, total) });
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
        const stage = typeof req.body?.stage === 'string' && isSalesStage(req.body.stage) ? req.body.stage : undefined;
        const ai = await whatsappAiService.processWhatsAppMessage(message, [], { recordGaps: false, salesStage: stage });
        return res.status(200).json({
            success: true,
            data: {
                reply: ai.reply,
                escalate: ai.escalate,
                stage: ai.stage,
                stageReason: ai.stageReason,
                priceAllowed: ai.priceAllowed,
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

async function listGaps(req: Request, res: Response) {
    try {
        const p = parsePage(req.query);
        const { items, total } = await knowledgeBaseService.listGaps({ like: likePattern(req.query.q), limit: p.limit, offset: p.offset, channel: parseKbChannel(req.query.channel) });
        return res.status(200).json({ success: true, data: items, meta: pageMeta(p, total) });
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

// One cheap call for the header cards and every tab badge, so the page never has to load a full list to count it.
async function stats(req: Request, res: Response) {
    try {
        const channel = parseKbChannel(req.query.channel);
        const [kb, learning] = await Promise.all([knowledgeBaseService.chunkStats(channel), aiLearning.learningStats(channel)]);
        return res.status(200).json({ success: true, data: { ...kb, ...learning } });
    } catch (err: any) {
        return fail(res, err);
    }
}

export default { stats, listChunks, createChunk, updateChunk, deleteChunk, testAnswer, listGaps, deleteGap };
