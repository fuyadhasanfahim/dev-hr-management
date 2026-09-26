import type { Request, Response } from 'express';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import whatsappService from '../services/whatsapp.service.js';
import whatsappAiService from '../services/whatsapp-ai.service.js';
import WhatsAppConversationModel, { WhatsAppConversationStatus } from '../models/whatsapp-conversation.model.js';
import WhatsAppMessageModel, { WhatsAppMessageDirection, WhatsAppMessageSender } from '../models/whatsapp-message.model.js';
import { createTicket } from '../services/support-ticket.service.js';
import { TicketSource } from '../models/ticket.model.js';
import { notifyAgents } from '../socket/support.namespace.js';

// GET — Meta's one-time webhook verification handshake.
export function verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === envConfig.meta_webhook_verify_token) {
        res.status(200).send(challenge);
        return;
    }
    res.sendStatus(403);
}

interface IncomingMessage {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: { body: string };
}

// POST — Meta pushes incoming messages + delivery/read statuses, and (with
// coexistence) message echoes for replies an agent sent from the WhatsApp
// Business app itself. Acknowledge immediately (Meta retries on
// timeout/non-2xx); process after responding.
export function receiveWebhook(req: Request, res: Response) {
    res.sendStatus(200);

    const entries = req.body?.entry ?? [];
    for (const entry of entries) {
        for (const change of entry.changes ?? []) {
            const value = change.value ?? {};
            const contactName = value.contacts?.[0]?.profile?.name;
            for (const message of (value.messages ?? []) as IncomingMessage[]) {
                if (message.type !== 'text' || !message.text?.body) continue;
                void handleIncomingMessage(message.from, message.text.body, message.id, contactName).catch(
                    (err) => logger.error(`Failed to handle WhatsApp message ${message.id}: ${err.message}`),
                );
            }
        }
    }
}

async function handleIncomingMessage(
    fromPhone: string,
    body: string,
    whatsappMsgId: string,
    contactName?: string,
) {
    // Idempotency: Meta may redeliver the same message on retry.
    const existing = await WhatsAppMessageModel.findOne({ whatsappMsgId });
    if (existing) return;

    let conversation = await WhatsAppConversationModel.findOne({
        customerPhone: fromPhone,
        status: { $ne: WhatsAppConversationStatus.RESOLVED },
    }).sort({ lastMessageAt: -1 });

    if (!conversation) {
        conversation = await WhatsAppConversationModel.create({
            customerPhone: fromPhone,
            customerName: contactName,
            status: WhatsAppConversationStatus.BOT,
        });
    }

    await WhatsAppMessageModel.create({
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.INBOUND,
        sender: WhatsAppMessageSender.CUSTOMER,
        body,
        whatsappMsgId,
    });
    conversation.lastMessageAt = new Date();
    await conversation.save();

    void whatsappService.markMessageRead(whatsappMsgId).catch(() => {});

    // AI off (agent already handling it manually via the app) or already
    // escalated to a human ticket — the bot stays quiet either way.
    if (!conversation.aiEnabled || conversation.status !== WhatsAppConversationStatus.BOT) return;

    const priorMessages = await WhatsAppMessageModel.find({ conversationId: conversation._id })
        .sort({ createdAt: 1 })
        .limit(20);
    const history = priorMessages.map((m) => ({
        role: (m.sender === WhatsAppMessageSender.CUSTOMER ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.body,
    }));

    const ai = await whatsappAiService.processWhatsAppMessage(body, history);

    const sentId = await whatsappService.sendTextMessage(fromPhone, ai.reply);
    await WhatsAppMessageModel.create({
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.OUTBOUND,
        sender: WhatsAppMessageSender.AI,
        body: ai.reply,
        whatsappMsgId: sentId,
    });

    if (ai.escalate) {
        const transcript = [...history, { role: 'user' as const, content: body }]
            .map((m) => `[${m.role === 'user' ? 'Customer' : 'AI'}]: ${m.content}`)
            .join('\n');

        const ticket = await createTicket({
            subject: `WhatsApp: ${conversation.customerName || fromPhone}`,
            text: `${ai.escalateReason || 'AI handed off to a human agent.'}\n\n--- Chat Transcript ---\n${transcript}`,
            source: TicketSource.WHATSAPP,
            visitorName: conversation.customerName || fromPhone,
            whatsappPhone: fromPhone,
        });

        conversation.status = WhatsAppConversationStatus.ESCALATED;
        conversation.linkedTicketId = ticket._id;
        await conversation.save();

        notifyAgents('ticket:created', {
            ticketId: ticket._id?.toString?.() ?? '',
            ticketRef: ticket.ticketId ?? '',
            subject: ticket.subject ?? '',
        });
    }
}

export default { verifyWebhook, receiveWebhook };
