import type { Request, Response } from 'express';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import whatsappService from '../services/whatsapp.service.js';
import whatsappAiService from '../services/whatsapp-ai.service.js';
import { WhatsAppConversationStatus } from '../models/whatsapp-conversation.model.js';
import WhatsAppMessageModel, {
    WhatsAppMessageDirection,
    WhatsAppMessageSender,
    WhatsAppMessageStatus,
    WhatsAppMessageType,
} from '../models/whatsapp-message.model.js';
import { isValidMetaSignature } from '../lib/whatsapp-signature.js';
import { parseEcho, parseIncoming, senderId, type EchoMessage, type HistoryThread, type IncomingMessage, type InboundContent } from '../lib/whatsapp-inbound.js';
import whatsappSupportService, { findOrCreateConversation, previewText } from '../services/whatsapp-support.service.js';
import { handleCallEvent, handleCallStatus, type CallEvent, type CallStatus } from '../services/whatsapp-call.service.js';
import { notifyMessageStatus } from '../services/whatsapp-send.queue.js';
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

// POST — Meta pushes incoming messages + delivery/read statuses, and (with
// coexistence) message echoes for replies an agent sent from the WhatsApp
// Business app itself. Acknowledge immediately (Meta retries on
// timeout/non-2xx); process after responding.
export function receiveWebhook(req: Request, res: Response) {
    // app.ts hands this route the raw bytes — the signature covers them exactly.
    const raw = req.body;
    if (!Buffer.isBuffer(raw) || !isValidMetaSignature(raw, req.get('x-hub-signature-256'), envConfig.meta_app_secret)) {
        logger.warn('Rejected WhatsApp webhook with a missing or invalid signature');
        res.sendStatus(401);
        return;
    }
    res.sendStatus(200);

    let body: any;
    try {
        body = JSON.parse(raw.toString('utf8'));
    } catch {
        return;
    }

    for (const entry of body?.entry ?? []) {
        for (const change of entry.changes ?? []) {
            const value = change.value ?? {};
            // One number only: the app's webhook also carries every other number
            // subscribed to it (other WABAs), which must not reach this inbox.
            if (value.metadata?.phone_number_id !== envConfig.whatsapp_phone_number_id) continue;
            const contactName = value.contacts?.[0]?.profile?.name || value.contacts?.[0]?.profile?.username;
            for (const message of (value.messages ?? []) as IncomingMessage[]) {
                const content = parseIncoming(message);
                const sender = senderId(message);
                if (!content || !sender) continue;
                void handleIncomingMessage(sender, { ...content, whatsappMsgId: message.id }, contactName).catch(
                    (err) => logger.error(`Failed to handle WhatsApp message ${message.id}: ${err.message}`),
                );
            }
            for (const echo of (value.message_echoes ?? []) as EchoMessage[]) {
                void handleEcho(echo).catch((err) => logger.error(`Failed to handle WhatsApp echo ${echo.id}: ${err.message}`));
            }
            for (const batch of (value.history ?? []) as { threads?: HistoryThread[]; errors?: { code?: number; title?: string }[] }[]) {
                if (batch.errors?.length) {
                    logger.warn(`WhatsApp history sync refused: ${JSON.stringify(batch.errors)}`);
                    continue;
                }
                void whatsappSupportService
                    .importHistoryThreads(batch.threads ?? [])
                    .then(({ conversationIds, messages }) => {
                        logger.info(`Imported ${messages} WhatsApp history messages across ${conversationIds.length} chats`);
                        for (const conversationId of conversationIds) notifyAgents('whatsapp:message_updated', { conversationId });
                    })
                    .catch((err) => logger.error(`Failed to import WhatsApp history: ${err.message}`));
            }
            for (const sync of (value.state_sync ?? []) as { type?: string; action?: string; contact?: { full_name?: string; phone_number?: string } }[]) {
                if (sync.type !== 'contact' || sync.action !== 'add' || !sync.contact) continue;
                void whatsappSupportService
                    .applyContactNames([sync.contact])
                    .catch((err) => logger.error(`Failed to apply WhatsApp contact name: ${err.message}`));
            }
            for (const call of (value.calls ?? []) as CallEvent[]) {
                void handleCallEvent(call, contactName).catch(
                    (err) => logger.error(`Failed to handle WhatsApp call ${call.id}: ${err.message}`),
                );
            }
            for (const status of (value.statuses ?? []) as (StatusUpdate | CallStatus)[]) {
                const handled = status.type === 'call' ? handleCallStatus(status as CallStatus) : handleStatusUpdate(status as StatusUpdate);
                void handled.catch(
                    (err) => logger.error(`Failed to handle WhatsApp status for ${status.id}: ${err.message}`),
                );
            }
        }
    }
}

interface StatusUpdate {
    id: string; // Meta's message id of OUR outbound message
    type?: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    errors?: { title?: string; message?: string; error_data?: { details?: string } }[];
}

const STATUS_RANK: Record<string, number> = {
    [WhatsAppMessageStatus.PENDING]: 0,
    [WhatsAppMessageStatus.SENT]: 1,
    [WhatsAppMessageStatus.DELIVERED]: 2,
    [WhatsAppMessageStatus.READ]: 3,
};

// Status webhooks can arrive out of order (read before delivered), so only ever
// move a message forward: sent → delivered → read. `failed` wins unless it was
// already read.
// ponytail: a status that beats the send worker's save of the Meta id finds no
// message and is dropped; Meta sends the next status later, so ticks self-heal.
async function handleStatusUpdate(update: StatusUpdate) {
    let set: Record<string, unknown>;
    let allowedFrom: string[];
    if (update.status === 'failed') {
        const e = update.errors?.[0];
        set = { status: WhatsAppMessageStatus.FAILED, error: e?.error_data?.details || e?.message || e?.title || 'Not delivered' };
        allowedFrom = [WhatsAppMessageStatus.PENDING, WhatsAppMessageStatus.SENT, WhatsAppMessageStatus.DELIVERED];
    } else {
        const rank = STATUS_RANK[update.status];
        if (rank === undefined) return;
        set = { status: update.status };
        allowedFrom = Object.keys(STATUS_RANK).filter((s) => STATUS_RANK[s]! < rank);
    }

    const message = await WhatsAppMessageModel.findOneAndUpdate(
        { whatsappMsgId: update.id, status: { $in: allowedFrom } },
        set,
        { new: true },
    );
    if (message) notifyMessageStatus(message);
}


// Something the business did in the WhatsApp Business app (coexistence): a new
// reply, or an edit/delete of an earlier one. Mirror it so the CRM thread matches.
async function handleEcho(echo: EchoMessage) {
    const parsed = parseEcho(echo);
    if (!parsed) {
        logger.warn(`Unreadable WhatsApp echo (type ${echo.type}): ${JSON.stringify(echo).slice(0, 500)}`);
        return;
    }

    if (parsed.kind === 'edit' || parsed.kind === 'revoke') {
        const update =
            parsed.kind === 'edit'
                ? { $set: { body: parsed.body, editedAt: new Date() } }
                : { $set: { deletedAt: new Date(), body: '' }, $unset: { media: 1 } };
        const message = await WhatsAppMessageModel.findOneAndUpdate({ whatsappMsgId: parsed.originalId }, update);
        if (message) notifyAgents('whatsapp:message_updated', { conversationId: message.conversationId.toString() });
        return;
    }

    if (await WhatsAppMessageModel.exists({ whatsappMsgId: parsed.whatsappMsgId })) return;
    const conversation = await findOrCreateConversation(parsed.customer);
    await WhatsAppMessageModel.create({
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.OUTBOUND,
        sender: WhatsAppMessageSender.AGENT,
        status: WhatsAppMessageStatus.SENT,
        fromApp: true,
        whatsappMsgId: parsed.whatsappMsgId,
        ...parsed.content,
    });
    // A human answered from the phone: the bot stays quiet from here on.
    conversation.lastMessageAt = new Date();
    conversation.lastReadAt = conversation.lastMessageAt;
    conversation.aiEnabled = false;
    await conversation.save();
    notifyAgents('whatsapp:new_message', { conversationId: conversation._id.toString() });
}

async function handleIncomingMessage(fromPhone: string, content: InboundContent, contactName?: string) {
    const { whatsappMsgId, body } = content;
    // Idempotency: Meta may redeliver the same message on retry.
    const existing = await WhatsAppMessageModel.findOne({ whatsappMsgId });
    if (existing) return;

    const conversation = await findOrCreateConversation(fromPhone, contactName);

    await WhatsAppMessageModel.create({
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.INBOUND,
        sender: WhatsAppMessageSender.CUSTOMER,
        ...content,
    });
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Enough for a live toast anywhere (support or dashboard) without a refetch.
    notifyAgents('whatsapp:new_message', {
        conversationId: conversation._id.toString(),
        fromCustomer: true,
        name: conversation.customerName || conversation.customerPhone,
        preview: previewText(content),
        assignedTo: conversation.assignedTo?.id ? conversation.assignedTo : null,
    });

    void whatsappService.markMessageRead(whatsappMsgId).catch(() => {});

    // AI off (agent already handling it manually via the app) or already
    // escalated to a human ticket — the bot stays quiet either way.
    // The AI only reads text — media and call events wait for a human.
    if (process.env.WHATSAPP_AI_DISABLED === "1" || !conversation.aiEnabled || conversation.status !== WhatsAppConversationStatus.BOT) return;
    if (content.type !== WhatsAppMessageType.TEXT) return;

    // The 20 most recent turns before this message (oldest-first), so a long chat
    // keeps its latest context. The message being answered is passed separately.
    const priorMessages = await WhatsAppMessageModel.find({
        conversationId: conversation._id,
        body: { $ne: '' },
        whatsappMsgId: { $ne: whatsappMsgId },
        type: WhatsAppMessageType.TEXT,
        deletedAt: { $exists: false },
    })
        .sort({ createdAt: -1 })
        .limit(20);
    const history = priorMessages.reverse().map((m) => ({
        role: (m.sender === WhatsAppMessageSender.CUSTOMER ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.body,
    }));

    const ai = await whatsappAiService.processWhatsAppMessage(body, history, { customerName: conversation.customerName });

    const sentId = await whatsappService.sendTextMessage(fromPhone, ai.reply);
    await WhatsAppMessageModel.create({
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.OUTBOUND,
        sender: WhatsAppMessageSender.AI,
        body: ai.reply,
        whatsappMsgId: sentId,
        status: WhatsAppMessageStatus.SENT,
    });
    notifyAgents('whatsapp:new_message', { conversationId: conversation._id.toString() });

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
