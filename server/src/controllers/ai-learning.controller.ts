import type { Request, Response } from 'express';
import aiLearning from '../services/ai-learning.service.js';
import { KnowledgeBaseError } from '../services/knowledge-base.service.js';
import { likePattern, pageMeta, parsePage } from '../utils/pagination.js';
import { parseKbChannel } from '../constants/knowledge-base.js';

const fail = (res: Response, err: any) =>
    res.status(err instanceof KnowledgeBaseError ? 400 : 500).json({ success: false, message: err.message });
const who = (req: Request) => req.user?.name ?? 'Staff';
const str = (v: unknown) => (typeof v === 'string' ? v : '');

async function listReplies(req: Request, res: Response) {
    try {
        const p = parsePage(req.query);
        const { items, total } = await aiLearning.listReplies({
            status: str(req.query.status),
            channel: parseKbChannel(req.query.channel),
            like: likePattern(req.query.q),
            limit: p.limit,
            offset: p.offset,
        });
        return res.status(200).json({ success: true, data: items, meta: pageMeta(p, total) });
    } catch (err: any) {
        return fail(res, err);
    }
}

async function correctReply(req: Request, res: Response) {
    try {
        const data = await aiLearning.correctReply(req.params.id!, str(req.body?.reply), who(req));
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        return fail(res, err);
    }
}

async function answerGap(req: Request, res: Response) {
    try {
        const data = await aiLearning.answerGap(req.params.id!, str(req.body?.reply), who(req));
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        return fail(res, err);
    }
}

async function listExamples(req: Request, res: Response) {
    try {
        const approved = req.query.approved === 'true' ? true : req.query.approved === 'false' ? false : undefined;
        const p = parsePage(req.query);
        const { items, total } = await aiLearning.listExamples({
            kind: str(req.query.kind) || undefined,
            approved,
            like: likePattern(req.query.q),
            limit: p.limit,
            offset: p.offset,
        });
        return res.status(200).json({ success: true, data: items, meta: pageMeta(p, total) });
    } catch (err: any) {
        return fail(res, err);
    }
}

async function createExample(req: Request, res: Response) {
    try {
        const data = await aiLearning.createQa(str(req.body?.question), str(req.body?.reply), who(req));
        return res.status(201).json({ success: true, data });
    } catch (err: any) {
        return fail(res, err);
    }
}

async function updateExample(req: Request, res: Response) {
    try {
        const { question, reply, approved } = req.body ?? {};
        const data = await aiLearning.updateExample(req.params.id!, {
            question: typeof question === 'string' ? question : undefined,
            answer: typeof reply === 'string' ? reply : undefined,
            approved: typeof approved === 'boolean' ? approved : undefined,
        });
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        return fail(res, err);
    }
}

async function deleteExample(req: Request, res: Response) {
    try {
        await aiLearning.deleteExample(req.params.id!);
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return fail(res, err);
    }
}

async function styleGuide(_req: Request, res: Response) {
    try {
        return res.status(200).json({ success: true, data: { text: await aiLearning.draftStyleGuide() } });
    } catch (err: any) {
        return fail(res, err);
    }
}

export default { listReplies, correctReply, answerGap, listExamples, createExample, updateExample, deleteExample, styleGuide };
