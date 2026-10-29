import { randomBytes } from 'node:crypto';
import { emailTicketCreated } from './ticket-notify.service.js';
import TicketModel, { TicketCategory } from '../models/ticket.model.js';
import TicketMessageModel, { MessageSenderModel } from '../models/ticket-message.model.js';
import { AppError } from '../utils/AppError.js';
import { Types } from 'mongoose';

/** A resolved or closed ticket is finished: customers can't write on it, and only an admin can touch it again. */
export const isLockedStatus = (status?: string) => status === 'resolved' || status === 'closed';
export const canTouchLocked = (role?: string) => role === 'admin' || role === 'super_admin';

interface CreateTicketData {
    subject: string;
    text: string;
    attachments?: string[];
    priority?: any;
    category?: string;
    source: string;        // Required — every flow must set this explicitly
    clientId?: string;
    guestId?: string;
    visitorName?: string;  // Snapshot of submitter identity
    visitorEmail?: string;
    whatsappPhone?: string; // Set when source is 'whatsapp'
    visitorPhone?: string; // Phone the visitor gave
    visitorIsWhatsapp?: boolean; // ...and whether it is on WhatsApp
    chatSessionId?: string; // Set when the ticket is a website live chat
    assignedTo?: string;   // Pre-assign (e.g. carry over from live-chat)
}

/**
 * Creates a new support ticket and its initial message.
 */
export async function createTicket(data: CreateTicketData): Promise<any> {
    if (!data.subject || !data.text) {
        throw new AppError('Subject and description are required', 400);
    }

    // Random 6-digit refs can collide; re-roll until free so two tickets never share a number.
    let ticketId = '';
    for (let i = 0; i < 5; i++) {
        ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
        if (!(await TicketModel.exists({ ticketId }))) break;
    }

    const ticketFields: any = {
        ticketId,
        subject: data.subject,
        priority: data.priority || 'medium',
        category: data.category || TicketCategory.SUPPORT,
        source: data.source,
        status: 'open',
        staffUnread: 1, // new for the team until someone opens it
        // The private link's key is made with the ticket, so the email and every later read agree on it.
        publicToken: randomBytes(18).toString('base64url'),
        attachments: data.attachments || [],
        tags: [],
    };

    if (data.clientId) {
        ticketFields.clientId = new Types.ObjectId(data.clientId);
    }
    if (data.guestId) {
        ticketFields.guestId = new Types.ObjectId(data.guestId);
    }
    if (data.visitorName) {
        ticketFields.visitorName = data.visitorName;
    }
    if (data.visitorEmail) {
        ticketFields.visitorEmail = data.visitorEmail;
    }
    if (data.whatsappPhone) {
        ticketFields.whatsappPhone = data.whatsappPhone;
    }
    if (data.visitorPhone) {
        ticketFields.visitorPhone = data.visitorPhone;
        if (typeof data.visitorIsWhatsapp === 'boolean') ticketFields.visitorIsWhatsapp = data.visitorIsWhatsapp;
    }
    if (data.chatSessionId) {
        ticketFields.chatSessionId = new Types.ObjectId(data.chatSessionId);
    }
    if (data.assignedTo) {
        ticketFields.assignedTo = new Types.ObjectId(data.assignedTo);
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

    if (!senderId && data.visitorName) {
        msgFields.senderName = data.visitorName;
    }
    if (senderId) {
        msgFields.senderId = new Types.ObjectId(senderId);
    }

    await TicketMessageModel.create(msgFields);

    // Email the ticket number with a private link to follow it and reply. Not awaited. A live chat is already a
    // conversation: it only gets the email if it is later turned into a ticket.
    if (data.source !== 'live_chat') void emailTicketCreated(ticket._id);

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
    category?: any;
}) {
    const query: any = {};
    if (filters.clientId) query.clientId = new Types.ObjectId(filters.clientId);
    if (filters.guestId) query.guestId = new Types.ObjectId(filters.guestId);
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.category) query.category = filters.category;

    return await TicketModel.find(query)
        .populate('clientId', 'name email')
        .populate('guestId', 'name email')
        .populate('assignedTo', 'name email')
        .populate('contactId', 'name phones emails whatsappPhone clientId leadId')
        .populate('chatSessionId', 'sessionId status')
        .sort({ updatedAt: -1 });
}

/**
 * Retrieves a single ticket and its message history.
 */
export async function getTicketDetails(ticketId: string, user: { id: string; role: string }) {
    const ticket = await TicketModel.findById(ticketId)
        .populate('clientId', 'name email')
        .populate('guestId', 'name email')
        .populate('assignedTo', 'name email')
        .populate('contactId', 'name phones emails whatsappPhone clientId leadId')
        .populate('chatSessionId', 'sessionId status') as any;

    if (!ticket) {
        throw new AppError('Ticket not found', 404);
    }

    // guestId/clientId are populated above, so the field is a document, not an
    // ObjectId — read its _id for the ownership check (falls back to the raw value
    // when population is skipped, e.g. the referenced doc was deleted).
    const guestOwnerId = (ticket.guestId?._id ?? ticket.guestId)?.toString();
    const clientOwnerId = (ticket.clientId?._id ?? ticket.clientId)?.toString();

    if (user.role === 'Guest' && guestOwnerId !== user.id) {
        throw new AppError('Access denied', 403);
    }
    if (user.role === 'client' && clientOwnerId !== user.id) {
        throw new AppError('Access denied', 403);
    }

    // Clients/guests must never see internal staff notes — scope them out at the
    // query level so they never leave the server. Staff/admin keep full visibility.
    const messageQuery: any = { ticketId: ticket._id };
    if (user.role === 'client' || user.role === 'Guest') {
        messageQuery.isInternalNote = { $ne: true };
    }

    const messages = await TicketMessageModel.find(messageQuery)
        .populate('senderId', 'name email')
        .sort({ createdAt: 1 });

    const [firstMessage, ...replyMessages] = messages;

    // The team opening a ticket is what marks it read.
    const byStaff = user.role !== 'client' && user.role !== 'Guest';
    if (byStaff && (ticket.staffUnread ?? 0) > 0) await TicketModel.updateOne({ _id: ticket._id }, { $set: { staffUnread: 0 } });

    return {
        ...ticket.toObject(),
        ...(byStaff ? { staffUnread: 0 } : {}),
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
        category?: any;
        assignedTo?: string;
        tags?: string[];
    },
    actorRole?: string,
): Promise<any> {
    const ticket = await TicketModel.findById(ticketId) as any;
    if (!ticket) {
        throw new AppError('Ticket not found', 404);
    }
    if (isLockedStatus(ticket.status) && !canTouchLocked(actorRole)) {
        throw new AppError(`This ticket is ${ticket.status}. Only an admin can change it.`, 403);
    }

    if (updates.status) ticket.status = updates.status;
    if (updates.priority) ticket.priority = updates.priority;
    if (updates.category) ticket.category = updates.category;
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
    actorRole,
}: {
    ticketId: string;
    senderId: string;
    senderType: 'client' | 'guest' | 'staff';
    text: string;
    attachments?: string[];
    actorRole?: string;
}) {
    const ticket = await TicketModel.findById(ticketId) as any;
    if (!ticket) {
        throw new AppError('Ticket not found', 404);
    }

    // Finished tickets are locked: a customer can't write on them, and only an admin can reply or reopen one.
    if (isLockedStatus(ticket.status)) {
        if (senderType !== 'staff') throw new AppError(`This ticket is ${ticket.status}.`, 409);
        if (!canTouchLocked(actorRole)) throw new AppError(`This ticket is ${ticket.status}. Only an admin can reply or change it.`, 403);
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
        ticket.staffUnread = (ticket.staffUnread ?? 0) + 1;
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
