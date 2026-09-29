import WhatsAppConversationModel from '../models/whatsapp-conversation.model.js';
import WhatsAppMessageModel, { WhatsAppMessageDirection, WhatsAppMessageSender } from '../models/whatsapp-message.model.js';
import whatsappService from './whatsapp.service.js';
import type { IWhatsAppMessage } from '../models/whatsapp-message.model.js';

export interface ConversationSummary {
    id: string;
    name: string;
    phone: string;
    status: string;
    aiEnabled: boolean;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
}

export interface MessageSummary {
    id: string;
    direction: WhatsAppMessageDirection;
    sender: WhatsAppMessageSender;
    body: string;
    createdAt: string;
}

function toMessageSummary(m: IWhatsAppMessage): MessageSummary {
    return {
        id: m._id!.toString(),
        direction: m.direction,
        sender: m.sender,
        body: m.body,
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
        .select('conversationId direction body createdAt')
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
            lastMessageAt: c.lastMessageAt.toISOString(),
            unreadCount,
        };
    });
}

async function getMessages(conversationId: string): Promise<MessageSummary[]> {
    const messages = await WhatsAppMessageModel.find({ conversationId }).sort({ createdAt: 1 });
    return messages.map(toMessageSummary);
}

// Sends via the real WhatsApp Cloud API (whatsappService — same Graph API path
// the AI pipeline uses) so agent replies are indistinguishable from any other
// official-API message. Flips aiEnabled off: once a human is typing, the bot
// should stay quiet on this conversation.
async function sendAgentMessage(conversationId: string, body: string): Promise<MessageSummary> {
    const conversation = await WhatsAppConversationModel.findById(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const whatsappMsgId = await whatsappService.sendTextMessage(conversation.customerPhone, body);

    const message = await WhatsAppMessageModel.create({
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.OUTBOUND,
        sender: WhatsAppMessageSender.AGENT,
        body,
        whatsappMsgId,
    });

    conversation.lastMessageAt = new Date();
    conversation.aiEnabled = false;
    await conversation.save();

    return toMessageSummary(message);
}

async function markConversationRead(conversationId: string): Promise<void> {
    await WhatsAppConversationModel.findByIdAndUpdate(conversationId, { lastReadAt: new Date() });
}

export default { listConversations, getMessages, sendAgentMessage, markConversationRead };
