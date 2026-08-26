import type { Request, Response } from 'express';
import envConfig from '../config/env.config.js';
import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import whatsappService from '../services/whatsapp.service.js';
import whatsappAiService from '../services/whatsapp-ai.service.js';
import notificationService from '../services/notification.service.js';

// GET — Meta's one-time webhook verification handshake.
export function verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === envConfig.whatsapp_webhook_verify_token) {
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

// POST — Meta pushes incoming messages + delivery/read statuses here.
// Acknowledge immediately (Meta retries on timeout/non-2xx); process after responding.
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
    const existing = await prisma.whatsAppMessage.findUnique({ where: { whatsappMsgId } });
    if (existing) return;

    let conversation = await prisma.whatsAppConversation.findFirst({
        where: { customerPhone: fromPhone, status: { not: 'resolved' } },
        orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
        conversation = await prisma.whatsAppConversation.create({
            data: { customerPhone: fromPhone, customerName: contactName, status: 'bot' },
        });
    }

    await prisma.whatsAppMessage.create({
        data: {
            conversationId: conversation.id,
            direction: 'inbound',
            sender: 'customer',
            body,
            whatsappMsgId,
        },
    });
    await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
    });

    void whatsappService.markMessageRead(whatsappMsgId).catch(() => {});

    // Once escalated to a human, the bot stops replying — the assigned agent takes over.
    if (conversation.status !== 'bot') return;

    const priorMessages = await prisma.whatsAppMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        take: 20,
    });
    const history = priorMessages.map((m) => ({
        role: (m.sender === 'customer' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.body,
    }));

    const ai = await whatsappAiService.processWhatsAppMessage(body, history);

    const sentId = await whatsappService.sendTextMessage(fromPhone, ai.reply);
    await prisma.whatsAppMessage.create({
        data: {
            conversationId: conversation.id,
            direction: 'outbound',
            sender: 'ai',
            body: ai.reply,
            whatsappMsgId: sentId,
        },
    });

    if (ai.escalate) {
        await prisma.whatsAppConversation.update({
            where: { id: conversation.id },
            data: { status: 'escalated' },
        });
        await notificationService.notifyWhatsAppEscalation({
            conversationId: conversation.id,
            customerPhone: conversation.customerPhone,
            customerName: conversation.customerName ?? undefined,
            reason: ai.escalateReason,
        });
    }
}

export default { verifyWebhook, receiveWebhook };
