import TicketModel from '../models/ticket.model.js';
import TicketMessageModel, { MessageSenderModel } from '../models/ticket-message.model.js';
import { AppError } from '../utils/AppError.js';
import { Types } from 'mongoose';

interface CreateTicketData {
    subject: string;
    text: string;
    attachments?: string[];
    priority?: any;
    clientId?: string;
    guestId?: string;
}

/**
 * Creates a new support ticket and its initial message.
 */
export async function createTicket(data: CreateTicketData): Promise<any> {
    if (!data.subject || !data.text) {
        throw new AppError('Subject and description are required', 400);
    }

    const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;

    const ticketFields: any = {
        ticketId,
        subject: data.subject,
        priority: data.priority || 'medium',
        status: 'open',
        attachments: data.attachments || [],
        tags: [],
    };

    if (data.clientId) {
        ticketFields.clientId = new Types.ObjectId(data.clientId);
    }
    if (data.guestId) {
        ticketFields.guestId = new Types.ObjectId(data.guestId);
    }

    const ticket = await TicketModel.create(ticketFields) as any;

    const senderModel = data.clientId ? MessageSenderModel.CLIENT : MessageSenderModel.GUEST;
    const senderId = data.clientId ? data.clientId : data.guestId;

    const msgFields: any = {
        ticketId: ticket._id,
        senderModel,
        content: data.text,
        attachments: data.attachments || [],
    };

    if (senderId) {
        msgFields.senderId = new Types.ObjectId(senderId);
    }

    await TicketMessageModel.create(msgFields);

    return ticket;
}

/**
 * Lists tickets with role-based filtering.
 */
export async function listTickets(filters: {
    clientId?: string;
    guestId?: string;
    status?: any;
    priority?: any;
}) {
    const query: any = {};
    if (filters.clientId) query.clientId = new Types.ObjectId(filters.clientId);
    if (filters.guestId) query.guestId = new Types.ObjectId(filters.guestId);
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;

    return await TicketModel.find(query)
        .populate('clientId', 'name email')
        .populate('guestId', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ updatedAt: -1 });
}

/**
 * Retrieves a single ticket and its message history.
 */
export async function getTicketDetails(ticketId: string, user: { id: string; role: string }) {
    const ticket = await TicketModel.findById(ticketId)
        .populate('clientId', 'name email')
        .populate('guestId', 'name email')
        .populate('assignedTo', 'name email') as any;

    if (!ticket) {
        throw new AppError('Ticket not found', 404);
    }

    if (user.role === 'Guest' && ticket.guestId?.toString() !== user.id) {
        throw new AppError('Access denied', 403);
    }
    if (user.role === 'client' && ticket.clientId?.toString() !== user.id) {
        throw new AppError('Access denied', 403);
    }

    const messages = await TicketMessageModel.find({ ticketId: ticket._id })
        .populate('senderId', 'name email')
        .sort({ createdAt: 1 });

    const [firstMessage, ...replyMessages] = messages;

    return {
        ...ticket.toObject(),
        text: firstMessage?.content ?? '',
        replies: replyMessages.map(m => ({
            ...m.toObject(),
            text: m.content,
            senderType: m.senderModel.toLowerCase(),
        })),
    };
}

/**
 * Updates a ticket (e.g. status, assignee, priority).
 */
export async function updateTicket(
    ticketId: string,
    updates: {
        status?: any;
        priority?: any;
        assignedTo?: string;
        tags?: string[];
    }
): Promise<any> {
    const ticket = await TicketModel.findById(ticketId) as any;
    if (!ticket) {
        throw new AppError('Ticket not found', 404);
    }

    if (updates.status) ticket.status = updates.status;
    if (updates.priority) ticket.priority = updates.priority;
    if (updates.assignedTo) ticket.assignedTo = new Types.ObjectId(updates.assignedTo);
    if (updates.tags) ticket.tags = updates.tags;

    await ticket.save();
    return ticket;
}

/**
 * Adds a new reply message to a ticket.
 */
export async function addTicketReply({
    ticketId,
    senderId,
    senderType,
    text,
    attachments,
}: {
    ticketId: string;
    senderId: string;
    senderType: 'client' | 'guest' | 'staff';
    text: string;
    attachments?: string[];
}) {
    const ticket = await TicketModel.findById(ticketId) as any;
    if (!ticket) {
        throw new AppError('Ticket not found', 404);
    }

    if (ticket.status === 'closed') {
        throw new AppError('Cannot reply to a closed ticket', 400);
    }

    let senderModel = MessageSenderModel.STAFF;
    if (senderType === 'client') {
        senderModel = MessageSenderModel.CLIENT;
    } else if (senderType === 'guest') {
        senderModel = MessageSenderModel.GUEST;
    }

    const message = await TicketMessageModel.create({
        ticketId: ticket._id,
        senderId: new Types.ObjectId(senderId),
        senderModel,
        content: text,
        attachments: attachments || [],
    });

    if (senderType === 'staff') {
        ticket.status = 'pending_client';
    } else {
        ticket.status = 'in_progress';
    }
    await ticket.save();

    return message;
}

export default {
    createTicket,
    listTickets,
    getTicketDetails,
    updateTicket,
    addTicketReply,
};
