import { Types } from 'mongoose';
import WhatsAppConversationModel from '../models/whatsapp-conversation.model.js';
import WhatsAppMessageModel, {
    WhatsAppMessageDirection,
    WhatsAppMessageSender,
    WhatsAppMessageStatus,
} from '../models/whatsapp-message.model.js';
import { enqueueWhatsAppSend } from './whatsapp-send.queue.js';
import { notifyAgents } from '../socket/support.namespace.js';
import type { IWhatsAppMessage } from '../models/whatsapp-message.model.js';

export interface ConversationSummary {
    id: string;
    name: string;
    phone: string;
    status: string;
    aiEnabled: boolean;
    lastMessage: string;
    lastMessageDirection: WhatsAppMessageDirection | null;
    lastMessageStatus: WhatsAppMessageStatus | null;
    lastMessageAt: string;
    unreadCount: number;
}

export interface MessageSummary {
    id: string;
    direction: WhatsAppMessageDirection;
    sender: WhatsAppMessageSender;
    body: string;
    status: WhatsAppMessageStatus | null;
    error: string | null;
    createdAt: string;
}

function toMessageSummary(m: IWhatsAppMessage): MessageSummary {
    return {
        id: m._id!.toString(),
        direction: m.direction,
        sender: m.sender,
        body: m.body,
        status: m.status ?? null,
        error: m.error ?? null,
        createdAt: m.createdAt.toISOString(),
    };
}

// ponytail: loads every message for every conversation to compute the preview
// + unread count in one round trip. Fine at support-team scale — move to an
// aggregation (or a denormalized lastMessage/unreadCount on the conversation
// doc) if the message table gets big enough for this to show up in profiling.
async function listConversations(): Promise<ConversationSummary[]> {
    const conversations = await WhatsAppConversationModel.find().sort({ lastMessageAt: -1 }).lean();
    if (conversations.length === 0) return [];

    const messages = await WhatsAppMessageModel.find({
        conversationId: { $in: conversations.map((c) => c._id) },
    })
        .sort({ createdAt: 1 })
        .select('conversationId direction body status createdAt')
        .lean();

    const byConversation = new Map<string, typeof messages>();
    for (const m of messages) {
        const key = m.conversationId.toString();
        const list = byConversation.get(key);
        if (list) list.push(m);
        else byConversation.set(key, [m]);
    }

    return conversations.map((c) => {
        const convMessages = byConversation.get(c._id.toString()) ?? [];
        const lastMessage = convMessages[convMessages.length - 1];
        const unreadCount = convMessages.filter(
            (m) => m.direction === WhatsAppMessageDirection.INBOUND && m.createdAt > c.lastReadAt,
        ).length;

        return {
            id: c._id.toString(),
            name: c.customerName || c.customerPhone,
            phone: c.customerPhone,
            status: c.status,
            aiEnabled: c.aiEnabled,
            lastMessage: lastMessage?.body ?? '',
            lastMessageDirection: lastMessage?.direction ?? null,
            lastMessageStatus: lastMessage?.status ?? null,
            lastMessageAt: c.lastMessageAt.toISOString(),
            unreadCount,
        };
    });
}

async function getMessages(conversationId: string): Promise<MessageSummary[]> {
    const messages = await WhatsAppMessageModel.find({ conversationId }).sort({ createdAt: 1 });
    return messages.map(toMessageSummary);
}

// Saves the reply as `pending` and hands the actual Cloud API call to the Redis
// send queue, so the agent's UI never waits on Meta. Flips aiEnabled off: once
// a human is typing, the bot should stay quiet on this conversation.
async function sendAgentMessage(conversationId: string, body: string): Promise<MessageSummary> {
    const conversation = await WhatsAppConversationModel.findById(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const _id = new Types.ObjectId();
    const message = await WhatsAppMessageModel.create({
        _id,
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.OUTBOUND,
        sender: WhatsAppMessageSender.AGENT,
        body,
        whatsappMsgId: `pending:${_id}`,
        status: WhatsAppMessageStatus.PENDING,
    });

    conversation.lastMessageAt = new Date();
    conversation.aiEnabled = false;
    await conversation.save();

    await enqueueWhatsAppSend(_id.toString());
    notifyAgents('whatsapp:new_message', { conversationId });

    return toMessageSummary(message);
}

async function retryMessage(conversationId: string, messageId: string): Promise<MessageSummary> {
    const message = await WhatsAppMessageModel.findOneAndUpdate(
        { _id: messageId, conversationId, status: WhatsAppMessageStatus.FAILED },
        { status: WhatsAppMessageStatus.PENDING, $unset: { error: 1 } },
        { new: true },
    );
    if (!message) throw new Error('Failed message not found');

    await enqueueWhatsAppSend(messageId);
    return toMessageSummary(message);
}

async function markConversationRead(conversationId: string): Promise<void> {
    await WhatsAppConversationModel.findByIdAndUpdate(conversationId, { lastReadAt: new Date() });
}

export default { listConversations, getMessages, sendAgentMessage, retryMessage, markConversationRead };
