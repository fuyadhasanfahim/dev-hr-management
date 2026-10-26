import type { Request, Response } from 'express';
import aiConversationService from '../services/ai-conversation.service.js';

/** Staff: the website assistant's chats, newest first (the inbox list). */
async function list(req: Request, res: Response) {
    try {
        const data = await aiConversationService.listConversations({
            q: typeof req.query.q === 'string' ? req.query.q : undefined,
            limit: Number(req.query.limit) || undefined,
        });
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

/** Staff: one website chat with its whole thread, what the AI remembers, and the visitor's contact + ticket. */
async function detail(req: Request, res: Response) {
    try {
        const data = await aiConversationService.getConversationDetail(String(req.params.conversationId ?? ''));
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

export default { list, detail };
