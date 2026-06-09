import type { Request, Response } from 'express';
import { processAIChat, getWebBriksInfo } from '../services/ai-chat.service.js';
import consultationService from '../services/consultation.service.js';
import liveChatService from '../services/live-chat.service.js';
import supportTicketService from '../services/support-ticket.service.js';
import aiConversationService from '../services/ai-conversation.service.js';
import guestAuthService from '../services/guest-auth.service.js';
import { notifyNewSession, notifyAgents } from '../socket/support.namespace.js';
import { logger } from '../lib/logger.js';

async function chat(req: Request, res: Response) {
    try {
        const { message, history, conversationId } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const chatHistory = Array.isArray(history) ? history : [];

        const result = await processAIChat(message, chatHistory);

        // Auto-save consultation when AI decides to book
        if (result.action === 'book_consultation' && result.consultationData) {
            const { name, email, phone, projectDescription, projectType } = result.consultationData;
            if (name && email && projectDescription) {
                try {
                    const transcript = chatHistory
                        .map((msg: any) => {
                            const role = msg.role === 'user' ? 'Customer' : 'AI';
                            const text = msg.parts?.[0]?.text || '';
                            return `[${role}]: ${text}`;
                        })
                        .join('\n');

                    await consultationService.createConsultation({
                        name,
                        email,
                        phone,
                        projectDescription,
                        projectType,
                        source: 'ai_chat',
                        chatTranscript: transcript,
                    });

                    logger.info(`Consultation auto-created for ${name} (${email}) via AI chat`);
                } catch (err: any) {
                    logger.error(`Failed to auto-create consultation: ${err.message}`);
                }
            }
        }

        // Persist the AI chat turn (non-blocking — never fail the chat on a logging error)
        let savedConversationId: string | undefined;
        try {
            const isGuest = req.user?.role === 'Guest';
            const conversation = await aiConversationService.appendTurn({
                conversationId,
                clientId: !isGuest ? req.user?.id : undefined,
                guestId: isGuest ? req.user?.id : undefined,
                visitorEmail: result.consultationData?.email,
                userMessage: message,
                aiReply: result.reply,
                action: result.action,
            });
            savedConversationId = conversation.conversationId;
        } catch (err: any) {
            logger.error(`Failed to persist AI conversation: ${err.message}`);
        }

        return res.status(200).json({ success: true, data: result, conversationId: savedConversationId });
    } catch (err: any) {
        const geminiStatus = err.status ?? err.statusCode ?? 0;
        logger.error(`AI Chat error: [status=${geminiStatus}] ${err.message} ${err.stack ?? ''}`);
        const isTransient = [429, 500, 502, 503, 504].includes(geminiStatus)
            || /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|quota|INTERNAL|rate.limit|capacity/i.test(err.message)
            || err.name === 'APIConnectionError'
            || err.name === 'APIConnectionTimeoutError';
        return res.status(isTransient ? 503 : 500).json({
            success: false,
            retryable: isTransient,
            message: isTransient
                ? 'AI assistant is experiencing high demand. Please try again in a moment.'
                : 'AI assistant is temporarily unavailable. Please try again or connect to live support.',
        });
    }
}

async function createTicketFromAI(req: Request, res: Response) {
    try {
        const { subject, description, chatHistory, category, name, email } = req.body;

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

        // Collect any attachment URLs from chat history messages
        const chatAttachments: string[] = [];
        if (Array.isArray(chatHistory)) {
            for (const msg of chatHistory) {
                if (Array.isArray(msg.attachments)) {
                    chatAttachments.push(...msg.attachments);
                }
            }
        }

        const ticketArgs: any = {
            subject,
            text: description + transcript,
            attachments: chatAttachments.length > 0 ? chatAttachments : undefined,
            priority: 'medium',
            category: category || 'support',
            source: 'ai_chat',
        };

        // Identity: a verified session/guest wins; otherwise an unverified visitor
        // must supply name + email, which we attach to a (created-if-needed) guest.
        if (req.user?.role === 'Guest') {
            ticketArgs.guestId = req.user.id;
            ticketArgs.visitorName = (req.user as any).name || name;
            ticketArgs.visitorEmail = (req.user as any).email || email;
        } else if (req.user?.id) {
            ticketArgs.clientId = req.user.id;
            ticketArgs.visitorName = (req.user as any).name || name;
            ticketArgs.visitorEmail = (req.user as any).email || email;
        } else if (email && name) {
            const guest = await guestAuthService.getOrCreateGuest(email, name);
            ticketArgs.guestId = guest._id.toString();
            ticketArgs.visitorName = name;
            ticketArgs.visitorEmail = email;
        } else {
            return res.status(400).json({ success: false, message: 'Please provide your name and email to create a ticket.' });
        }

        const result = await supportTicketService.createTicket(ticketArgs);

        // Alert the support console (REST ticket creation has no socket of its own).
        notifyAgents('ticket:created', {
            ticketId: (result as any)?._id?.toString?.() ?? '',
            ticketRef: (result as any)?.ticketId ?? '',
            subject: (result as any)?.subject ?? subject ?? '',
        });

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
        notifyNewSession(result.sessionId);
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
