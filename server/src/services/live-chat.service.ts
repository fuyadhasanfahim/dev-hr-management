import ChatSessionModel from '../models/chat-session.model.js';
import ChatMessageModel from '../models/chat-message.model.js';
import TicketModel from '../models/ticket.model.js';
import TicketMessageModel, { MessageSenderModel } from '../models/ticket-message.model.js';
import { addToChatQueue, removeFromChatQueue } from './redis-queue.service.js';
import { AppError } from '../utils/AppError.js';
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

    const ticket = await TicketModel.create(ticketFields) as any;

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

    session.status = 'converted_to_ticket';
    session.linkedTicketId = ticket._id;
    await session.save();

    await removeFromChatQueue(sessionId);

    return { ticketId: ticket.ticketId };
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
    reassignSession,
    getUnreadCountsForAgent,
};
