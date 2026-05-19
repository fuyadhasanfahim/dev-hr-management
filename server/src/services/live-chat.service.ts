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
 */
export async function convertChatToTicket(sessionId: string, reason?: string): Promise<{ ticketId: string }> {
    const session = await ChatSessionModel.findOne({ sessionId }) as any;
    if (!session) {
        throw new AppError('Chat session not found', 404);
    }

    if (session.status === 'converted_to_ticket' && session.linkedTicketId) {
        const ticket = await TicketModel.findById(session.linkedTicketId);
        if (ticket) {
            return { ticketId: (ticket as any).ticketId };
        }
    }

    const messages = await ChatMessageModel.find({ sessionId: session._id }).sort({ createdAt: 1 });
    
    let descriptionText = `[System: Converted from Support Live Chat]\n`;
    if (reason) {
        descriptionText += `Reason: ${reason}\n\n`;
    }
    
    descriptionText += `Chat Transcript:\n`;
    for (const msg of messages) {
        const sender = msg.senderModel === 'Client' ? 'Client' : (msg.senderModel === 'Guest' ? 'Guest' : 'Agent');
        descriptionText += `[${msg.createdAt.toISOString()}] ${sender} (${msg.senderName}): ${msg.content}\n`;
    }

    const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;

    const ticketFields: any = {
        ticketId,
        subject: `Live Chat Support - ${new Date().toLocaleDateString()}`,
        status: 'open',
        priority: 'medium',
        attachments: [],
        tags: ['Live Chat Converted'],
    };

    if (session.clientId) {
        ticketFields.clientId = session.clientId;
    }
    if (session.guestId) {
        ticketFields.guestId = session.guestId;
    }

    const ticket = await TicketModel.create(ticketFields) as any;

    const senderModel = session.clientId ? MessageSenderModel.CLIENT : MessageSenderModel.GUEST;
    const senderId = session.clientId ? session.clientId : session.guestId;

    const msgFields: any = {
        ticketId: ticket._id,
        senderModel,
        content: descriptionText,
        attachments: [],
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

export default {
    createChatSession,
    assignAgentToSession,
    convertChatToTicket,
    endChatSession,
};
