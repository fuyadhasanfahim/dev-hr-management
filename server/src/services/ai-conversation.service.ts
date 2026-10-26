import AiConversationModel, {
    AiChatAction,
    AiMessageRole,
    type IAiMessage,
} from '../models/ai-conversation.model.js';
import { AppError } from '../utils/AppError.js';
import crypto from 'crypto';
import { Types } from 'mongoose';

/** Who the visitor turned out to be, filled in as we learn it (guest sign-in, a ticket, a consultation). */
export interface VisitorInfo {
    visitorEmail?: string;
    visitorName?: string;
    visitorPhone?: string;
    contactId?: Types.ObjectId | string;
    linkedTicketId?: Types.ObjectId | string;
}

/**
 * Appends a single AI chat turn (the user message + the model reply) to a
 * conversation, creating the conversation if it does not yet exist.
 */
export async function appendTurn(
    args: {
        conversationId?: string;
        clientId?: string;
        guestId?: string;
        userMessage: string;
        aiReply: string;
        action: string;
    } & VisitorInfo,
): Promise<any> {
    const { conversationId, clientId, guestId, userMessage, aiReply, action, ...visitor } = args;

    const userTurn: IAiMessage = {
        role: AiMessageRole.USER,
        content: userMessage,
    };
    const modelTurn: IAiMessage = {
        role: AiMessageRole.MODEL,
        content: aiReply,
        action: action as AiChatAction,
    };

    // Only fill what is missing: the first answer we got stays.
    const fill = (target: any) => {
        if (visitor.visitorEmail && !target.visitorEmail) target.visitorEmail = visitor.visitorEmail;
        if (visitor.visitorName && !target.visitorName) target.visitorName = visitor.visitorName;
        if (visitor.visitorPhone && !target.visitorPhone) target.visitorPhone = visitor.visitorPhone;
        if (visitor.contactId && !target.contactId) target.contactId = new Types.ObjectId(String(visitor.contactId));
        if (visitor.linkedTicketId) target.linkedTicketId = new Types.ObjectId(String(visitor.linkedTicketId));
    };

    if (conversationId) {
        const existing = await AiConversationModel.findOne({ conversationId });
        if (existing) {
            existing.messages.push(userTurn, modelTurn);
            existing.lastAction = action as AiChatAction;
            existing.messageCount += 2;
            fill(existing);
            await existing.save();
            return existing;
        }
    }

    const conversationFields: any = {
        conversationId: crypto.randomUUID(),
        messages: [userTurn, modelTurn],
        lastAction: action as AiChatAction,
        messageCount: 2,
    };

    if (clientId) {
        conversationFields.clientId = new Types.ObjectId(clientId);
    }
    if (guestId) {
        conversationFields.guestId = new Types.ObjectId(guestId);
    }
    fill(conversationFields);

    const conversation = await AiConversationModel.create(conversationFields);
    return conversation;
}

/**
 * Retrieves a single AI conversation by its conversationId.
 */
export async function getConversation(conversationId: string): Promise<any> {
    const conversation = await AiConversationModel.findOne({ conversationId });
    if (!conversation) {
        throw new AppError('AI conversation not found', 404);
    }
    return conversation;
}

/** Staff inbox: the newest website chats, optionally filtered by name / email / phone. */
export async function listConversations(opts: { q?: string; limit?: number } = {}): Promise<any[]> {
    const filter: any = {};
    const q = opts.q?.trim();
    if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ visitorName: rx }, { visitorEmail: rx }, { visitorPhone: rx }, { 'messages.content': rx }];
    }
    const rows = await AiConversationModel.find(filter)
        .sort({ updatedAt: -1 })
        .limit(Math.min(opts.limit ?? 50, 100))
        .populate('linkedTicketId', 'ticketId status')
        .lean();
    return rows.map((c: any) => {
        const last = c.messages?.[c.messages.length - 1];
        return {
            conversationId: c.conversationId,
            visitorName: c.visitorName ?? null,
            visitorEmail: c.visitorEmail ?? null,
            visitorPhone: c.visitorPhone ?? null,
            contactId: c.contactId ?? null,
            messageCount: c.messageCount,
            lastAction: c.lastAction ?? null,
            lastMessage: last ? { role: last.role, content: String(last.content).slice(0, 140) } : null,
            ticket: c.linkedTicketId ? { _id: c.linkedTicketId._id, ticketId: c.linkedTicketId.ticketId, status: c.linkedTicketId.status } : null,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        };
    });
}

/** One website chat for the inbox: the whole thread plus what the AI remembers and who it is. */
export async function getConversationDetail(conversationId: string): Promise<any> {
    const c: any = await AiConversationModel.findOne({ conversationId })
        .populate('linkedTicketId', 'ticketId status subject')
        .populate('contactId', 'name phones emails whatsappPhone clientId leadId aiMemory')
        .lean();
    if (!c) throw new AppError('AI conversation not found', 404);
    return {
        conversationId: c.conversationId,
        visitorName: c.visitorName ?? null,
        visitorEmail: c.visitorEmail ?? null,
        visitorPhone: c.visitorPhone ?? null,
        messages: c.messages,
        aiMemory: c.aiMemory || c.contactId?.aiMemory || '',
        contact: c.contactId ?? null,
        ticket: c.linkedTicketId ?? null,
        lastAction: c.lastAction ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
    };
}

export async function saveMemory(conversationId: string, memory: string): Promise<void> {
    await AiConversationModel.updateOne({ conversationId }, { $set: { aiMemory: memory } });
}

export default {
    appendTurn,
    getConversation,
    listConversations,
    getConversationDetail,
    saveMemory,
};
