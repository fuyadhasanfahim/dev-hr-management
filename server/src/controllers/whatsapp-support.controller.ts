import type { Request, Response } from 'express';
import whatsappSupportService from '../services/whatsapp-support.service.js';

async function listConversations(_req: Request, res: Response) {
    try {
        const conversations = await whatsappSupportService.listConversations();
        return res.status(200).json({ success: true, data: conversations });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function getMessages(req: Request, res: Response) {
    try {
        const messages = await whatsappSupportService.getMessages(req.params.id!);
        return res.status(200).json({ success: true, data: messages });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function sendMessage(req: Request, res: Response) {
    try {
        const { text } = req.body;
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, message: 'text is required' });
        }
        const message = await whatsappSupportService.sendAgentMessage(req.params.id!, text.trim());
        return res.status(201).json({ success: true, data: message });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function retryMessage(req: Request, res: Response) {
    try {
        const message = await whatsappSupportService.retryMessage(req.params.id!, req.params.messageId!);
        return res.status(200).json({ success: true, data: message });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function markRead(req: Request, res: Response) {
    try {
        await whatsappSupportService.markConversationRead(req.params.id!);
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

export default { listConversations, getMessages, sendMessage, retryMessage, markRead };
