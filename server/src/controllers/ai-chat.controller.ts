import type { Request, Response } from 'express';
import { processAIChat, getWebBriksInfo } from '../services/ai-chat.service.js';
import { updateMemory } from '../services/whatsapp-ai.service.js';
import aiSettingsService from '../services/ai-settings.service.js';
import { contactIdFor } from '../services/contact.service.js';
import AiConversationModel from '../models/ai-conversation.model.js';
import ContactModel from '../models/contact.model.js';
import GuestModel from '../models/guest.model.js';
import consultationService from '../services/consultation.service.js';
import liveChatService from '../services/live-chat.service.js';
import supportTicketService from '../services/support-ticket.service.js';
import aiConversationService from '../services/ai-conversation.service.js';
import guestAuthService from '../services/guest-auth.service.js';
import { notifyNewSession, notifyAgents } from '../socket/support.namespace.js';
import { isAiActive } from '../services/ai-settings.service.js';
import { logger } from '../lib/logger.js';
import { ensurePublicToken } from '../services/ticket-notify.service.js';
import { runInOrder } from '../lib/keyed-queue.js';

async function chat(req: Request, res: Response) {
    try {
        const { message, history, conversationId } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        // Admin AI controls: when the website AI is off, tell the widget to hand over to a human.
        if (!(await isAiActive('web_chat'))) {
            return res.status(503).json({
                success: false,
                retryable: false,
                aiDisabled: true,
                message: 'Our AI assistant is offline right now. Please connect to live support or leave us a message.',
            });
        }

        const chatHistory = Array.isArray(history) ? history : [];
        const settings = await aiSettingsService.getSettings();

        // Who is this? A signed-in guest or client is known; anyone else is anonymous until they tell the AI.
        const isGuest = req.user?.role === 'Guest';
        const known: { name?: string; email?: string; phone?: string } = {};
        if (isGuest) {
            const g: any = await GuestModel.findById(req.user!.id).select('name email phone').lean();
            Object.assign(known, { name: g?.name, email: g?.email, phone: g?.phone });
        } else if (req.user?.id) {
            Object.assign(known, { name: (req.user as any).name, email: (req.user as any).email });
        }
        const existing: any = conversationId ? await AiConversationModel.findOne({ conversationId }).lean() : null;
        known.name ||= existing?.visitorName;
        known.email ||= existing?.visitorEmail;
        known.phone ||= existing?.visitorPhone;

        // Memory of this visitor: this conversation's, else what we learnt about the same person in earlier chats.
        let knownContactId: any = existing?.contactId;
        if (!knownContactId && (known.email || known.phone)) {
            knownContactId = await contactIdFor({ name: known.name, emails: [known.email], phones: [known.phone], guestId: isGuest ? req.user!.id : undefined });
        }
        let memory = '';
        if (settings.web.remember) {
            memory = existing?.aiMemory || '';
            if (!memory && knownContactId) memory = ((await ContactModel.findById(knownContactId).select('aiMemory').lean()) as any)?.aiMemory || '';
        }

        const result = await processAIChat(message, chatHistory, { memory, visitor: known, allowTickets: settings.web.createTickets });

        // The AI raised a ticket: it lands in Tickets like a WhatsApp one, with what the AI knows about the visitor.
        let raised: { ticketId: string; _id: string } | null = null;
        if (result.action === 'create_ticket' && result.ticket && result.visitor) {
            try {
                const v = result.visitor;
                const transcript = [...chatHistory.map((m: any) => `[${m.role === 'user' ? 'Customer' : 'AI'}]: ${m.parts?.[0]?.text ?? ''}`), `[Customer]: ${message}`, `[AI]: ${result.reply}`].join('\n');
                const text = [result.ticket.summary || 'The website assistant raised this ticket.', memory && `What the AI knows about the visitor:\n${memory}`, `--- Chat Transcript ---\n${transcript}`]
                    .filter(Boolean)
                    .join('\n\n');
                const ticketArgs: any = {
                    subject: result.ticket.subject,
                    text,
                    source: 'ai_chat',
                    category: result.ticket.category,
                    priority: result.ticket.priority,
                    visitorName: v.name,
                    visitorEmail: v.email,
                    visitorPhone: v.phone,
                    visitorIsWhatsapp: v.isWhatsapp,
                };
                if (req.user?.id && !isGuest) {
                    ticketArgs.clientId = req.user.id;
                } else {
                    ticketArgs.guestId = (await guestAuthService.getOrCreateGuest(v.email, v.name, { phone: v.phone, isWhatsapp: v.isWhatsapp }))._id.toString();
                }
                const ticket: any = await supportTicketService.createTicket(ticketArgs);
                raised = { ticketId: ticket.ticketId, _id: ticket._id.toString() };
                notifyAgents('ticket:created', { ticketId: raised._id, ticketRef: raised.ticketId, subject: ticket.subject ?? '' });
                logger.info(`Website AI raised ticket ${raised.ticketId} for ${v.email}`);
            } catch (err: any) {
                logger.error(`Website AI could not raise the ticket: ${err.message}`);
            }
        }

        // The visitor's identity, as far as it is now known (sign-in, what they told the AI, a consultation request).
        const seen: { name?: string; email?: string; phone?: string; isWhatsapp?: boolean } = result.visitor ?? {};
        const visitorName = known.name || seen.name || result.consultationData?.name;
        const visitorEmail = known.email || seen.email || result.consultationData?.email;
        const visitorPhone = known.phone || seen.phone || result.consultationData?.phone;
        if (!knownContactId && (visitorEmail || visitorPhone)) {
            knownContactId = await contactIdFor({ name: visitorName, emails: [visitorEmail], phones: [visitorPhone], whatsappPhone: seen.isWhatsapp ? seen.phone : undefined });
        }

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
            const conversation = await aiConversationService.appendTurn({
                conversationId,
                clientId: !isGuest ? req.user?.id : undefined,
                guestId: isGuest ? req.user?.id : undefined,
                visitorEmail,
                visitorName,
                visitorPhone,
                contactId: knownContactId,
                linkedTicketId: raised?._id,
                userMessage: message,
                aiReply: result.reply,
                action: result.action,
            });
            savedConversationId = conversation.conversationId;
        } catch (err: any) {
            logger.error(`Failed to persist AI conversation: ${err.message}`);
        }

        // Fold this exchange into the visitor's running profile (same helper the WhatsApp assistant uses). Not awaited.
        if (settings.web.remember && savedConversationId) {
            const turns = [
                ...chatHistory.slice(-8).map((m: any) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: String(m.parts?.[0]?.text ?? '') })),
                { role: 'user' as const, content: message },
                { role: 'assistant' as const, content: result.reply },
            ];
            const conversationKey = savedConversationId;
            void runInOrder(`webmemory:${conversationKey}`, async () => {
                const latest = ((await AiConversationModel.findOne({ conversationId: conversationKey }).select('aiMemory').lean()) as any)?.aiMemory ?? memory;
                const text = await updateMemory(latest, turns);
                await aiConversationService.saveMemory(conversationKey, text);
                if (knownContactId) await ContactModel.updateOne({ _id: knownContactId }, { $set: { aiMemory: text } });
            })
                .catch((err: any) => logger.error(`Could not update the website AI memory: ${err.message}`));
        }

        // The widget needs to know about a raised ticket, not the internal ticket/visitor brief.
        const { ticket: _brief, visitor: _visitor, ...publicResult } = result;
        void _brief;
        void _visitor;
        return res.status(200).json({ success: true, data: { ...publicResult, ticket: raised }, conversationId: savedConversationId });
    } catch (err: any) {
        const aiStatus = err.status ?? err.statusCode ?? 0;
        logger.error(`AI Chat error: [status=${aiStatus}] ${err.message} ${err.stack ?? ''}`);
        const isTransient = [429, 500, 502, 503, 504].includes(aiStatus)
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
        const { subject, description, chatHistory, category, name, email, phone, isWhatsapp } = req.body;

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
        // Phone from the widget form (and whether it is on WhatsApp), kept for the team and for contact matching.
        if (typeof phone === 'string' && phone.trim()) {
            ticketArgs.visitorPhone = phone.trim().slice(0, 40);
            if (typeof isWhatsapp === 'boolean') ticketArgs.visitorIsWhatsapp = isWhatsapp;
        }

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

        const publicToken = await ensurePublicToken((result as any)._id);
        return res.status(201).json({ success: true, data: { ...((result as any).toObject?.() ?? result), publicToken } });
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
