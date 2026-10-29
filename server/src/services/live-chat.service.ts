import ChatSessionModel from '../models/chat-session.model.js';
import ChatMessageModel, { ChatSenderModel } from '../models/chat-message.model.js';
import TicketModel from '../models/ticket.model.js';
import TicketMessageModel, { MessageSenderModel } from '../models/ticket-message.model.js';
import { addToChatQueue, removeFromChatQueue } from './redis-queue.service.js';
import { AppError } from '../utils/AppError.js';
import GuestModel from '../models/guest.model.js';
import ClientModel from '../models/client.model.js';
import { normalizePhone } from './contact.service.js';
import { findOrCreateConversation } from './whatsapp-support.service.js';
import { insideFreeTextWindow, emailTicketCreated } from './ticket-notify.service.js';
import * as whatsappService from './whatsapp.service.js';
import WhatsAppConversationModel from '../models/whatsapp-conversation.model.js';
import WhatsAppMessageModel, {
    WhatsAppMessageDirection,
    WhatsAppMessageSender,
    WhatsAppMessageStatus,
    WhatsAppMessageType,
} from '../models/whatsapp-message.model.js';
import envConfig from '../config/env.config.js';
import { getSupportNamespace } from '../socket/support.namespace.js';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';
import { Types } from 'mongoose';

/**
 * Initiates a new support chat session and queues it.
 */
export async function createChatSession({
    clientId,
    guestId,
}: {
    clientId?: string;
    guestId?: string;
}): Promise<any> {
    // A visitor who comes back (or clicks "connect" twice) rejoins their open chat instead of starting another one.
    // One conversation per visitor, like one WhatsApp thread per number: a returning visitor picks their latest chat
    // up again (even one that was ended or turned into a ticket) instead of getting a second row in the inbox.
    const owner = guestId ? { guestId: new Types.ObjectId(guestId) } : clientId ? { clientId: new Types.ObjectId(clientId) } : null;
    if (owner) {
        const prior: any = await ChatSessionModel.findOne({ ...owner, handedOffToWhatsApp: { $ne: true } }).sort({ updatedAt: -1 });
        if (prior) {
            if (prior.status === 'queued' || prior.status === 'active') return prior;
            prior.status = prior.assignedAgent ? 'active' : 'queued';
            await prior.save();
            if (prior.status === 'queued') await addToChatQueue(prior.sessionId);
            return prior;
        }
    }

    const sessionId = crypto.randomUUID();

    const sessionFields: any = {
        sessionId,
        status: 'queued',
    };

    if (clientId) {
        sessionFields.clientId = new Types.ObjectId(clientId);
    }
    if (guestId) {
        sessionFields.guestId = new Types.ObjectId(guestId);
    }

    const session = await ChatSessionModel.create(sessionFields);

    await addToChatQueue(sessionId);

    // A chat is not a ticket: the team opens one from the chat when it is needed (see convertChatToTicket).

    return session;
}

/**
 * Assigns an agent to a chat session, changing its status to active.
 */
export async function assignAgentToSession(sessionId: string, agentId: string): Promise<any> {
    const session = await ChatSessionModel.findOne({ sessionId }) as any;
    if (!session) {
        throw new AppError('Support chat session not found', 404);
    }

    session.assignedAgent = new Types.ObjectId(agentId);
    session.status = 'active';
    await session.save();

    await removeFromChatQueue(sessionId);

    await session.populate('clientId', 'name email');
    await session.populate('guestId', 'name email');
    await session.populate('assignedAgent', 'name email');

    return session;
}

/**
 * Converts an active or queued chat session into a support ticket.
 *
 * @param sessionId  - UUID of the chat session
 * @param options.reason   - Optional conversion reason (shown in transcript)
 * @param options.subject  - Agent-provided subject. Falls back to first visitor message.
 * @param options.category - Ticket category enum value (default 'support')
 */
export async function convertChatToTicket(
    sessionId: string,
    options?: { reason?: string; subject?: string; category?: string },
): Promise<{ ticketId: string }> {
    const session = await ChatSessionModel.findOne({ sessionId }) as any;
    if (!session) {
        throw new AppError('Chat session not found', 404);
    }

    // Idempotent: if already converted, return the existing ticket
    if (session.status === 'converted_to_ticket' && session.linkedTicketId) {
        const ticket = await TicketModel.findById(session.linkedTicketId);
        if (ticket) {
            return { ticketId: (ticket as any).ticketId };
        }
    }

    const messages = await ChatMessageModel.find({ sessionId: session._id }).sort({ createdAt: 1 });

    // ── Build readable transcript ────────────────────────────────────────
    let descriptionText = `[System: Converted from Support Live Chat]\n`;
    if (options?.reason) {
        descriptionText += `Reason: ${options.reason}\n\n`;
    }

    descriptionText += `Chat Transcript:\n`;
    for (const msg of messages) {
        const sender = msg.senderModel === 'Client' ? 'Client' : (msg.senderModel === 'Guest' ? 'Guest' : 'Agent');
        descriptionText += `[${msg.createdAt.toISOString()}] ${sender} (${msg.senderName}): ${msg.content}\n`;
    }

    // ── Collect ALL attachment URLs/keys from chat messages ───────────────
    // Reference existing S3 keys — no file duplication.
    const allChatAttachments: string[] = [];
    for (const msg of messages) {
        if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
            allChatAttachments.push(...msg.attachments);
        }
    }

    // ── Derive subject ───────────────────────────────────────────────────
    let ticketSubject = options?.subject?.trim();
    if (!ticketSubject) {
        // Smart fallback: first ~6 words of the visitor's first message
        const firstVisitorMsg = messages.find(
            (m) => m.senderModel === 'Client' || m.senderModel === 'Guest',
        );
        if (firstVisitorMsg?.content) {
            const words = firstVisitorMsg.content.split(/\s+/).slice(0, 6).join(' ');
            ticketSubject = `Live Chat: ${words}${firstVisitorMsg.content.split(/\s+/).length > 6 ? '...' : ''}`;
        } else {
            ticketSubject = `Live Chat Support - ${new Date().toLocaleDateString()}`;
        }
    }

    const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;

    const ticketFields: any = {
        ticketId,
        subject: ticketSubject,
        status: 'open',
        priority: 'medium',
        category: options?.category || 'support',
        source: 'live_chat',
        attachments: allChatAttachments,
        tags: ['Live Chat Converted'],
    };

    if (session.clientId) {
        ticketFields.clientId = session.clientId;
    }
    if (session.guestId) {
        ticketFields.guestId = session.guestId;
    }
    // Carry over the handling agent as the ticket assignee
    if (session.assignedAgent) {
        ticketFields.assignedTo = session.assignedAgent;
    }

    // Chats opened before tickets became on-demand already have one: reuse it instead of making a second.
    let ticket: any = await TicketModel.findOne({ chatSessionId: session._id });
    if (ticket) {
        ticket.subject = ticketSubject;
        ticket.category = ticketFields.category;
        ticket.attachments = allChatAttachments;
        ticket.tags = [...new Set([...(ticket.tags ?? []), 'Live Chat Converted'])];
        if (ticketFields.assignedTo) ticket.assignedTo = ticketFields.assignedTo;
        if (ticket.status === 'resolved' || ticket.status === 'closed') ticket.status = 'open';
        await ticket.save();
    } else {
        const guest: any = session.guestId ? await GuestModel.findById(session.guestId).select('name email phone isWhatsapp').lean() : null;
        const client: any = session.clientId ? await ClientModel.findById(session.clientId).select('name emails phone').lean() : null;
        ticket = await TicketModel.create({
            ...ticketFields,
            chatSessionId: session._id,
            publicToken: crypto.randomBytes(18).toString('base64url'),
            visitorName: guest?.name ?? client?.name,
            visitorEmail: guest?.email ?? client?.emails?.[0],
            visitorPhone: guest?.phone ?? client?.phone,
            visitorIsWhatsapp: guest?.isWhatsapp,
        });
    }

    const senderModel = session.clientId ? MessageSenderModel.CLIENT : MessageSenderModel.GUEST;
    const senderId = session.clientId ? session.clientId : session.guestId;

    const msgFields: any = {
        ticketId: ticket._id,
        senderModel,
        content: descriptionText,
        attachments: allChatAttachments,
    };

    if (senderId) {
        msgFields.senderId = new Types.ObjectId(senderId.toString());
    }

    await TicketMessageModel.create(msgFields);

    // A chat that becomes a ticket gets the ticket number and private link by email, like any other ticket.
    void emailTicketCreated(ticket._id);

    session.status = 'converted_to_ticket';
    session.linkedTicketId = ticket._id;
    await session.save();

    await removeFromChatQueue(sessionId);

    return { ticketId: ticket.ticketId };
}

const BENGALI = /[ঀ-৿]/;

/**
 * The team moves a website chat to WhatsApp: the visitor gets a WhatsApp message (free text inside the 24h window,
 * otherwise the approved hand-off template), the chat turns into a WhatsApp conversation assigned to the agent, and
 * the website chat becomes read-only with a note telling the visitor to continue on WhatsApp.
 */
export async function handOffToWhatsApp(sessionId: string, agent: { id: string; name: string }): Promise<{ conversationId: string }> {
    const session: any = await ChatSessionModel.findOne({ sessionId });
    if (!session) throw new AppError('Chat session not found', 404);
    if (session.handedOffToWhatsApp && session.whatsappConversationId) {
        return { conversationId: String(session.whatsappConversationId) };
    }
    if (!envConfig.meta_access_token || !envConfig.whatsapp_phone_number_id) throw new AppError('WhatsApp is not set up', 400);

    const guest: any = session.guestId ? await GuestModel.findById(session.guestId).select('name phone').lean() : null;
    const client: any = session.clientId ? await ClientModel.findById(session.clientId).select('name phone').lean() : null;
    const phone = normalizePhone(guest?.phone ?? client?.phone);
    if (!phone) throw new AppError('This visitor did not leave a phone number', 400);
    const name: string = guest?.name ?? client?.name ?? '';
    const first = name.trim().split(/\s+/)[0] || 'there';

    const recent = await ChatMessageModel.find({ sessionId: session._id }).sort({ createdAt: -1 }).limit(10).select('content').lean();
    const bengali = BENGALI.test(`${name} ${recent.map((m: any) => m.content).join(' ')}`);

    const conversation: any = await findOrCreateConversation(phone, name || undefined);
    let body: string;
    let messageId: string;
    try {
        if (await insideFreeTextWindow(conversation._id)) {
            body = bengali
                ? `${first}, আমাদের ওয়েবসাইটের চ্যাট এখন থেকে আমরা এই WhatsApp-এ চালিয়ে যাব। আপনি এখানেই লিখুন, আমরা দেখছি।`
                : `Hi ${first}, we're continuing your website chat here on WhatsApp. Just reply here and we'll pick it up right away.`;
            messageId = await whatsappService.sendTextMessage(phone, body);
        } else {
            body = bengali
                ? `${first}, আমাদের ওয়েবসাইটের চ্যাট এখন থেকে আমরা এই WhatsApp-এ চালিয়ে যাব। আপনি এখানেই লিখুন।`
                : `Hi ${first}, we're continuing your website chat here on WhatsApp. Reply here and we'll pick it up right away.`;
            messageId = await whatsappService.sendTemplateMessage(
                phone,
                bengali ? envConfig.wa_template_handoff_bn : envConfig.wa_template_handoff_en,
                bengali ? 'bn' : 'en',
                [first],
            );
        }
    } catch (err: any) {
        logger.warn(`[live chat] hand-off message failed for ${sessionId}: ${err.message}`);
        throw new AppError(`Could not send the WhatsApp message: ${err.message}`, 502);
    }

    await WhatsAppMessageModel.create({
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.OUTBOUND,
        sender: WhatsAppMessageSender.AGENT,
        type: WhatsAppMessageType.TEXT,
        body,
        whatsappMsgId: messageId || `handoff:${session._id}`,
        status: WhatsAppMessageStatus.SENT,
    });
    const ticket: any = await TicketModel.findOne({ chatSessionId: session._id }).select('_id');
    await WhatsAppConversationModel.updateOne(
        { _id: conversation._id },
        { $set: { lastMessageAt: new Date(), assignedTo: { id: agent.id, name: agent.name }, assignedAt: new Date(), ...(ticket ? { linkedTicketId: ticket._id } : {}) } },
    );
    if (ticket) await TicketModel.updateOne({ _id: ticket._id }, { $set: { whatsappPhone: phone } });

    session.handedOffToWhatsApp = true;
    session.whatsappConversationId = conversation._id;
    await session.save();
    await removeFromChatQueue(sessionId);

    // Tell the visitor in the widget, and everyone watching the chat.
    const note = await ChatMessageModel.create({
        sessionId: session._id,
        sender: new Types.ObjectId(agent.id),
        senderModel: ChatSenderModel.SYSTEM,
        senderName: 'System',
        content: bengali
            ? 'আমরা এই কথোপকথন WhatsApp-এ চালিয়ে যাচ্ছি। আপনার WhatsApp দেখুন।'
            : 'We are continuing this conversation on WhatsApp. Please check your WhatsApp.',
        attachments: [],
    });
    const ns = getSupportNamespace();
    ns?.to(sessionId).emit('chat:message', note);
    ns?.to(sessionId).emit('chat:handoff', { sessionId });
    ns?.to('agents_presence').emit('session:state_change', { type: 'handoff', sessionId });
    ns?.to('agents_presence').emit('whatsapp:conversation_updated', { conversationId: String(conversation._id) });

    return { conversationId: String(conversation._id) };
}

/**
 * Closes/Ends a support chat session.
 */
export async function endChatSession(sessionId: string): Promise<any> {
    const session = await ChatSessionModel.findOne({ sessionId }) as any;
    if (!session) {
        throw new AppError('Chat session not found', 404);
    }

    session.status = 'ended';
    await session.save();

    await removeFromChatQueue(sessionId);

    return session;
}

/**
 * Reassign a session to a different agent.
 */
export async function reassignSession(sessionId: string, newAgentId: string): Promise<any> {
    const session = await ChatSessionModel.findOne({ sessionId }) as any;
    if (!session) {
        throw new AppError('Chat session not found', 404);
    }
    if (session.status !== 'active') {
        throw new AppError('Only active sessions can be reassigned', 400);
    }

    session.assignedAgent = new Types.ObjectId(newAgentId);
    await session.save();

    await session.populate('clientId', 'name email');
    await session.populate('guestId', 'name email');
    await session.populate('assignedAgent', 'name email');

    return session;
}

/**
 * Get unread message counts per session for an agent.
 */
export async function getUnreadCountsForAgent(agentId: string): Promise<Record<string, number>> {
    const sessions = await ChatSessionModel.find({
        assignedAgent: new Types.ObjectId(agentId),
        status: 'active',
    });

    const counts: Record<string, number> = {};
    for (const session of sessions) {
        const unread = await ChatMessageModel.countDocuments({
            sessionId: session._id,
            sender: { $ne: new Types.ObjectId(agentId) },
            readBy: { $ne: new Types.ObjectId(agentId) },
        });
        if (unread > 0) {
            counts[session.sessionId] = unread;
        }
    }

    return counts;
}

export default {
    createChatSession,
    assignAgentToSession,
    convertChatToTicket,
    endChatSession,
    handOffToWhatsApp,
    reassignSession,
    getUnreadCountsForAgent,
};
