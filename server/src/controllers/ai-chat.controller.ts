import type { Request, Response } from 'express';
import { processAIChat, getWebBriksInfo } from '../services/ai-chat.service.js';
import liveChatService from '../services/live-chat.service.js';
import supportTicketService from '../services/support-ticket.service.js';
import { logger } from '../lib/logger.js';

async function chat(req: Request, res: Response) {
    try {
        const { message, history } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const chatHistory = Array.isArray(history) ? history : [];

        const result = await processAIChat(message, chatHistory);

        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        logger.error(`AI Chat error: ${err.message}`);
        return res.status(500).json({
            success: false,
            message: 'AI assistant is temporarily unavailable. Please try again or connect to live support.',
        });
    }
}

async function createTicketFromAI(req: Request, res: Response) {
    try {
        const { subject, description, chatHistory } = req.body;

        if (!subject || !description) {
            return res.status(400).json({ success: false, message: 'Subject and description are required' });
        }

        let transcript = '';
        if (Array.isArray(chatHistory) && chatHistory.length > 0) {
            transcript = '\n\n--- Chat Transcript ---\n';
            for (const msg of chatHistory) {
                const role = msg.role === 'user' ? 'Customer' : 'AI Assistant';
                const text = msg.parts?.[0]?.text || msg.text || '';
                transcript += `[${role}]: ${text}\n`;
            }
        }

        const ticketArgs: any = {
            subject,
            text: description + transcript,
            priority: 'medium',
        };

        if (req.user?.role === 'Guest') {
            ticketArgs.guestId = req.user.id;
        } else if (req.user?.id) {
            ticketArgs.clientId = req.user.id;
        }

        const result = await supportTicketService.createTicket(ticketArgs);
        return res.status(201).json({ success: true, data: result });
    } catch (err: any) {
        logger.error(`AI ticket creation error: ${err.message}`);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

async function connectLiveSupport(req: Request, res: Response) {
    try {
        const args: any = {};
        if (req.user?.role === 'Guest') {
            args.guestId = req.user.id;
        } else if (req.user?.id) {
            args.clientId = req.user.id;
        }

        const result = await liveChatService.createChatSession(args);
        return res.status(201).json({ success: true, data: result });
    } catch (err: any) {
        logger.error(`AI live support connect error: ${err.message}`);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

async function getInfo(_req: Request, res: Response) {
    try {
        const info = await getWebBriksInfo();
        return res.status(200).json({ success: true, data: info });
    } catch (err: any) {
        logger.error(`AI info error: ${err.message}`);
        return res.status(500).json({ success: false, message: err.message });
    }
}

export default {
    chat,
    createTicketFromAI,
    connectLiveSupport,
    getInfo,
};
