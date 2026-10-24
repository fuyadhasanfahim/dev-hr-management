import type { Request, Response } from 'express';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import whatsappService from '../services/whatsapp.service.js';
import whatsappAiService from '../services/whatsapp-ai.service.js';
import { agentReplyPolicy, isAiActive } from '../services/ai-settings.service.js';
import aiLearning from '../services/ai-learning.service.js';
import WhatsAppConversationModel, { WhatsAppConversationStatus, type IWhatsAppConversation } from '../models/whatsapp-conversation.model.js';
import { isAckOnly } from '../lib/sales-flow.js';
import { readMedia } from '../lib/media-reader.js';
import WhatsAppCustomerMemoryModel from '../models/whatsapp-customer-memory.model.js';
import WhatsAppNoteModel from '../models/whatsapp-note.model.js';
import ClientModel from '../models/client.model.js';
import WhatsAppMessageModel, {
    WhatsAppMessageDirection,
    WhatsAppMessageSender,
    WhatsAppMessageStatus,
    WhatsAppMessageType,
} from '../models/whatsapp-message.model.js';
import { isValidMetaSignature } from '../lib/whatsapp-signature.js';
import { parseEcho, parseIncoming, senderId, type EchoMessage, type HistoryThread, type IncomingMessage, type InboundContent } from '../lib/whatsapp-inbound.js';
import whatsappSupportService, { findByPhone, findOrCreateConversation, previewText } from '../services/whatsapp-support.service.js';
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
            // Calling isn't supported (WhatsApp coexistence): call events and call statuses are ignored.
            for (const status of (value.statuses ?? []) as (StatusUpdate & { type?: string })[]) {
                if (status.type === 'call') continue;
                void handleStatusUpdate(status).catch(
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
    const policy = await agentReplyPolicy();
    if (policy.pause) {
        conversation.aiEnabled = false;
        conversation.aiResumeAt = policy.resumeAt;
    }
    if (parsed.content.type === WhatsAppMessageType.TEXT) {
        void aiLearning.captureAgentReply(conversation._id, parsed.content.body ?? '', 'Phone app');
    }
    await conversation.save();
    notifyAgents('whatsapp:new_message', { conversationId: conversation._id.toString() });
}

async function handleIncomingMessage(fromPhone: string, content: InboundContent, contactName?: string) {
    const { whatsappMsgId } = content;
    // Idempotency: Meta may redeliver the same message on retry.
    const existing = await WhatsAppMessageModel.findOne({ whatsappMsgId });
    if (existing) return;

    const conversation = await findOrCreateConversation(fromPhone, contactName);

    const stored = await WhatsAppMessageModel.create({
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
    // Voice notes, photos and PDFs are read first (transcript / description / summary), then answered like text.
    // Other media and call events wait for a human.
    if (!conversation.aiEnabled || conversation.status !== WhatsAppConversationStatus.BOT) return;
    if (content.type !== WhatsAppMessageType.TEXT) {
        if (READABLE_MEDIA.includes(content.type) && content.media) {
            void readIncomingMedia(stored._id.toString(), content.type, content.media)
                .then((read) => read && scheduleAnswer(conversation._id.toString()))
                .catch((err: any) => logger.error(`WhatsApp media read failed: ${err.message}`));
        }
        return;
    }

    // Admin AI controls (off / schedule / per-feature switch) — see ai-settings.service.
    if (!(await isAiActive('whatsapp'))) return;

    scheduleAnswer(conversation._id.toString());
}

// Customers often send several short messages in a row ("Price" / "Koto" / "bolen"). Wait a moment so they are
// answered together in ONE reply instead of one reply per fragment.
// ponytail: in-memory timers, fine for the single devhr-server process; move to a queue if that ever scales out.
const ANSWER_DELAY_MS = 8_000;
const answerTimers = new Map<string, NodeJS.Timeout>();
const answering = new Set<string>();

function scheduleAnswer(conversationId: string, delay = ANSWER_DELAY_MS) {
    clearTimeout(answerTimers.get(conversationId));
    answerTimers.set(
        conversationId,
        setTimeout(() => {
            answerTimers.delete(conversationId);
            void answerPending(conversationId).catch((err: any) => logger.error(`WhatsApp AI answer failed for ${conversationId}: ${err.message}`));
        }, delay),
    );
}

// Answers whatever the customer has said since the last time we (AI) answered or a human colleague replied.
// Re-reads the chat first, so a message a human already handled is never answered a second time, late.
// Also used by the auto-resume sweep.
export async function answerPending(conversationId: string) {
    if (answering.has(conversationId)) return scheduleAnswer(conversationId, 3_000);
    answering.add(conversationId);
    try {
        const conversation = await WhatsAppConversationModel.findById(conversationId);
        if (!conversation || !conversation.aiEnabled || conversation.status !== WhatsAppConversationStatus.BOT) return;
        if (!(await isAiActive('whatsapp'))) return;

        const lastBy = (sender: WhatsAppMessageSender) =>
            WhatsAppMessageModel.findOne({ conversationId: conversation._id, sender }).sort({ createdAt: -1 }).select('createdAt');
        const [lastAgent, lastAi] = await Promise.all([lastBy(WhatsAppMessageSender.AGENT), lastBy(WhatsAppMessageSender.AI)]);
        const floor = Math.max(lastAgent?.createdAt.getTime() ?? 0, (conversation.aiAnsweredUpTo ?? lastAi?.createdAt)?.getTime() ?? 0);
        const pending = await WhatsAppMessageModel.find({
            conversationId: conversation._id,
            sender: WhatsAppMessageSender.CUSTOMER,
            $or: [{ type: WhatsAppMessageType.TEXT, body: { $ne: '' } }, { aiText: { $nin: [null, ''] } }],
            createdAt: { $gt: new Date(floor) },
            deletedAt: { $exists: false },
        }).sort({ createdAt: 1 });
        if (!pending.length) return;

        const answeredUpTo = pending[pending.length - 1]!.createdAt;
        // "thanks" / "welcome" / "joined" mid-chat: nothing to answer.
        if ((lastAi || lastAgent) && pending.every((m) => isAckOnly(messageText(m)))) {
            await WhatsAppConversationModel.updateOne({ _id: conversation._id }, { $set: { aiAnsweredUpTo: answeredUpTo } });
            return;
        }
        await answerWithAi(conversation, conversation.customerPhone, pending.map(messageText).join('\n'), pending.map((m) => m.whatsappMsgId), answeredUpTo);
    } finally {
        answering.delete(conversationId);
    }
}

const FILE_LABEL: Partial<Record<WhatsAppMessageType, string>> = {
    [WhatsAppMessageType.IMAGE]: 'a photo',
    [WhatsAppMessageType.VIDEO]: 'a video',
    [WhatsAppMessageType.AUDIO]: 'a voice message',
    [WhatsAppMessageType.DOCUMENT]: 'a document',
    [WhatsAppMessageType.STICKER]: 'a sticker',
};
const READABLE_MEDIA = [WhatsAppMessageType.AUDIO, WhatsAppMessageType.IMAGE, WhatsAppMessageType.DOCUMENT];

// What the AI sees for one message: the text, or for a file what was read from it (transcript / description / summary).
function messageText(m: { sender: WhatsAppMessageSender; type: WhatsAppMessageType; body: string; aiText?: string }): string {
    const label = FILE_LABEL[m.type];
    if (!label) return m.body;
    const who = m.sender === WhatsAppMessageSender.CUSTOMER ? 'Customer' : 'Team';
    const file = m.aiText ? `[${who} sent ${label}. AI reading: ${m.aiText}]` : `[${who} sent ${label}, which the AI cannot open]`;
    return m.body ? `${m.body}\n${file}` : file;
}

// Downloads a customer's voice note / photo / PDF from Meta and stores what the AI could read from it.
async function readIncomingMedia(messageId: string, type: WhatsAppMessageType, media: NonNullable<InboundContent['media']>): Promise<boolean> {
    const file = await whatsappService.downloadMedia(media.id);
    const bytes = Buffer.from(await new Response(file.body).arrayBuffer());
    const text = await readMedia(type, bytes, media.mimeType || file.mimeType, media.filename);
    if (!text) return false;
    await WhatsAppMessageModel.updateOne({ _id: messageId }, { $set: { aiText: text } });
    return true;
}

async function answerWithAi(
    conversation: IWhatsAppConversation,
    fromPhone: string,
    body: string,
    excludeMsgIds: string[],
    answeredUpTo: Date,
) {
    // The 30 most recent turns before the messages being answered (oldest-first). Photos, voice notes and
    // documents can't be read by the AI, but it must still know they were sent — otherwise it asks for what the
    // customer already provided. Human colleagues' turns are flagged so the AI continues their thread.
    const priorMessages = await WhatsAppMessageModel.find({
        conversationId: conversation._id,
        type: { $ne: WhatsAppMessageType.CALL },
        whatsappMsgId: { $nin: excludeMsgIds },
        deletedAt: { $exists: false },
    })
        .sort({ createdAt: -1 })
        .limit(30);
    const history = priorMessages.reverse().flatMap((m) => {
        const fromCustomer = m.sender === WhatsAppMessageSender.CUSTOMER;
        const text = messageText(m);
        if (!text) return [];
        return [{ role: (fromCustomer ? 'user' : 'assistant') as 'user' | 'assistant', content: text, human: m.sender === WhatsAppMessageSender.AGENT }];
    });

    // Per-customer memory (keyed by phone, so it survives a resolved chat starting again) and the team's internal notes.
    const [memoryDoc, noteDocs] = await Promise.all([
        WhatsAppCustomerMemoryModel.findOne({ customerPhone: conversation.customerPhone }).lean(),
        WhatsAppNoteModel.find({ customerPhone: conversation.customerPhone }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);
    const memory = memoryDoc?.text || conversation.aiMemory || '';

    const ai = await whatsappAiService.processWhatsAppMessage(body, history, {
        customerName: conversation.customerName,
        salesStage: conversation.salesStage ?? undefined,
        memory: memory || undefined,
        notes: noteDocs.map((n) => `- ${n.body.replace(/\s+/g, ' ').slice(0, 400)} (${n.author.name}, ${n.createdAt.toISOString().slice(0, 10)})`).join('\n') || undefined,
    });

    // A hand-off raises the support ticket first, so the customer is told its number in the same message.
    let ticket: any = null;
    let reply = ai.reply;
    if (ai.escalate) {
        try {
            ticket = await raiseHandoffTicket(conversation, fromPhone, body, history, ai, memory);
            reply += /[\u0980-\u09FF]/.test(reply) ? `\n\n🎫 আপনার টিকেট নম্বর: ${ticket.ticketId}` : `\n\n🎫 Your ticket reference: ${ticket.ticketId}`;
        } catch (err: any) {
            logger.error(`Could not raise the hand-off ticket for ${conversation._id}: ${err.message}`);
        }
    }

    const sentId = await whatsappService.sendTextMessage(fromPhone, reply);
    await WhatsAppMessageModel.create({
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.OUTBOUND,
        sender: WhatsAppMessageSender.AI,
        body: reply,
        whatsappMsgId: sentId,
        status: WhatsAppMessageStatus.SENT,
    });
    notifyAgents('whatsapp:new_message', { conversationId: conversation._id.toString() });

    // Remember where the sales flow stands (and why) — a new history entry only when the stage actually changes.
    // Never lets a bookkeeping failure break the reply that was already sent.
    try {
        conversation.aiAnsweredUpTo = answeredUpTo;
        conversation.salesStageReason = ai.stageReason;
        if (conversation.salesStage !== ai.stage) {
            conversation.salesStage = ai.stage;
            conversation.salesStageHistory = [...(conversation.salesStageHistory ?? []), { stage: ai.stage, reason: ai.stageReason, at: new Date() }].slice(-30);
        }
        await conversation.save();
    } catch (err: any) {
        logger.error(`Could not save sales stage: ${err.message}`);
    }

    // Kept for review: staff can read every AI reply and correct the ones that missed.
    void aiLearning.logReply({
        conversationId: conversation._id.toString(),
        customerName: conversation.customerName,
        customerMessage: body,
        context: history
            .slice(-6)
            .map((m) => `${m.role === 'user' ? 'Customer' : 'Team'}: ${m.content.replace(/\s+/g, ' ').slice(0, 400)}`)
            .join('\n'),
        aiReply: ai.reply,
        escalated: ai.escalate,
        topScore: ai.matches[0]?.score,
        sources: ai.matches.map((m) => (m.source ? `[${m.source}] ` : '') + m.text.slice(0, 120)),
    });

    // Fold this exchange (and any human colleague turns before it) into the customer's running profile.
    void whatsappAiService
        .updateMemory(memory, [...history.slice(-8), { role: 'user', content: body }, { role: 'assistant', content: ai.reply }])
        .then((text) => WhatsAppCustomerMemoryModel.updateOne({ customerPhone: conversation.customerPhone }, { $set: { text, updatedBy: 'AI' } }, { upsert: true }))
        .catch((err: any) => logger.error(`Could not update AI memory: ${err.message}`));

    if (ai.escalate && ticket) {
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

const TICKET_CATEGORIES = ['support', 'service', 'development', 'billing', 'bug'];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// The ticket the team works from: a specific subject, a short brief, what the AI knows about the customer, and the
// chat. Linked to the customer's client record when the number belongs to one, so it shows up under that client.
async function raiseHandoffTicket(
    conversation: IWhatsAppConversation,
    fromPhone: string,
    body: string,
    history: { role: 'user' | 'assistant'; content: string; human?: boolean }[],
    ai: Awaited<ReturnType<typeof whatsappAiService.processWhatsAppMessage>>,
    memory: string,
) {
    const transcript = [...history, { role: 'user' as const, content: body }]
        .map((m) => `[${m.role === 'user' ? 'Customer' : m.human ? 'Team' : 'AI'}]: ${m.content}`)
        .join('\n');
    const client = await findByPhone<any>(ClientModel, fromPhone, 'name').catch(() => null);
    const name = conversation.customerName || fromPhone;
    const text = [
        ai.ticket.summary || ai.escalateReason || 'AI handed off to a human agent.',
        ai.escalateReason && `Hand-off reason: ${ai.escalateReason}`,
        memory && `What the AI knows about the customer:\n${memory}`,
        conversation.salesStage && `Sales stage: ${conversation.salesStage}`,
        `--- Chat Transcript ---\n${transcript}`,
    ]
        .filter(Boolean)
        .join('\n\n');
    return createTicket({
        subject: ai.ticket.subject || `WhatsApp: ${name}`,
        text,
        source: TicketSource.WHATSAPP,
        category: TICKET_CATEGORIES.includes(ai.ticket.category) ? ai.ticket.category : 'support',
        priority: TICKET_PRIORITIES.includes(ai.ticket.priority) ? ai.ticket.priority : 'medium',
        visitorName: name,
        whatsappPhone: fromPhone,
        ...(client ? { clientId: client._id.toString() } : {}),
    });
}

export default { verifyWebhook, receiveWebhook };
