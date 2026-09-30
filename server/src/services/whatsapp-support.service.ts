import { Types } from 'mongoose';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import WhatsAppConversationModel, { WhatsAppConversationStatus } from '../models/whatsapp-conversation.model.js';
import WhatsAppMessageModel, {
    WhatsAppMessageDirection,
    WhatsAppMessageSender,
    WhatsAppMessageStatus,
    WhatsAppMessageType,
    type IWhatsAppMedia,
} from '../models/whatsapp-message.model.js';
import { enqueueWhatsAppSend } from './whatsapp-send.queue.js';
import whatsappService from './whatsapp.service.js';
import { notifyAgents } from '../socket/support.namespace.js';
import type { IWhatsAppMessage } from '../models/whatsapp-message.model.js';

const run = promisify(execFile);

/**
 * The customer's open (not resolved) conversation, or a new one. Shared by the
 * message webhook and incoming calls so both land in the same thread.
 */
export async function findOrCreateConversation(customerPhone: string, customerName?: string) {
    const existing = await WhatsAppConversationModel.findOne({
        customerPhone,
        status: { $ne: WhatsAppConversationStatus.RESOLVED },
    }).sort({ lastMessageAt: -1 });
    if (existing) return existing;
    return WhatsAppConversationModel.create({
        customerPhone,
        customerName,
        status: WhatsAppConversationStatus.BOT,
    });
}

const PREVIEW_LABEL: Record<string, string> = {
    image: '📷 Photo',
    video: '🎥 Video',
    audio: '🎵 Audio',
    document: '📄 Document',
    sticker: 'Sticker',
};

// Chat-list preview line, WhatsApp style: caption if there is one, else a label.
function previewText(m: { type?: string; body: string; media?: { voice?: boolean; filename?: string } | null }): string {
    if (!m.type || m.type === WhatsAppMessageType.TEXT || m.type === WhatsAppMessageType.CALL) return m.body;
    if (m.type === WhatsAppMessageType.AUDIO && m.media?.voice) return '🎤 Voice message';
    const label = m.type === WhatsAppMessageType.DOCUMENT && m.media?.filename ? `📄 ${m.media.filename}` : PREVIEW_LABEL[m.type];
    return m.body ? `${label} · ${m.body}` : (label ?? m.body);
}

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
    type: WhatsAppMessageType;
    body: string;
    media: IWhatsAppMedia | null;
    status: WhatsAppMessageStatus | null;
    error: string | null;
    clientId: string | null;
    createdAt: string;
}

function toMessageSummary(m: IWhatsAppMessage): MessageSummary {
    return {
        id: m._id!.toString(),
        direction: m.direction,
        sender: m.sender,
        type: m.type ?? WhatsAppMessageType.TEXT,
        body: m.body,
        media: m.media ? { id: m.media.id, mimeType: m.media.mimeType, filename: m.media.filename, voice: m.media.voice } : null,
        status: m.status ?? null,
        error: m.error ?? null,
        clientId: m.clientId ?? null,
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
        .select('conversationId direction type body media status createdAt')
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
            lastMessage: lastMessage ? previewText(lastMessage) : '',
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
async function sendAgentMessage(conversationId: string, body: string, clientId?: string): Promise<MessageSummary> {
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
        clientId,
    });

    conversation.lastMessageAt = new Date();
    conversation.aiEnabled = false;
    await conversation.save();

    await enqueueWhatsAppSend(_id.toString());
    notifyAgents('whatsapp:new_message', { conversationId });

    return toMessageSummary(message);
}

// Mime types WhatsApp accepts per message type; anything else goes as a document.
const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const VIDEO_TYPES = ['video/mp4', 'video/3gpp'];
const AUDIO_TYPES = ['audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/mpeg', 'audio/amr', 'audio/ogg'];

function mediaTypeFor(mimeType: string): WhatsAppMessageType {
    const base = mimeType.split(';')[0]!.trim();
    if (IMAGE_TYPES.includes(base)) return WhatsAppMessageType.IMAGE;
    if (VIDEO_TYPES.includes(base)) return WhatsAppMessageType.VIDEO;
    if (AUDIO_TYPES.includes(base)) return WhatsAppMessageType.AUDIO;
    return WhatsAppMessageType.DOCUMENT;
}

// WhatsApp only plays voice notes that are OGG/Opus; browsers record WebM
// (Chrome) or MP4 (Safari), so re-encode with ffmpeg. Firefox's ogg passes through.
async function toOggOpus(file: Buffer, mimeType: string): Promise<Buffer> {
    if (mimeType.startsWith('audio/ogg')) return file;
    const dir = await mkdtemp(path.join(tmpdir(), 'wa-voice-'));
    try {
        const input = path.join(dir, 'in');
        const output = path.join(dir, 'out.ogg');
        await writeFile(input, file);
        await run('ffmpeg', ['-y', '-i', input, '-vn', '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', output]);
        return await readFile(output);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

// Uploads to Meta inside the request (so a bad file fails right away), then
// queues the send exactly like a text reply.
async function sendAgentMedia(
    conversationId: string,
    file: { buffer: Buffer; mimeType: string; filename: string },
    options: { caption?: string; voice?: boolean; clientId?: string },
): Promise<MessageSummary> {
    const conversation = await WhatsAppConversationModel.findById(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    let { buffer, mimeType, filename } = file;
    if (options.voice) {
        buffer = await toOggOpus(buffer, mimeType);
        mimeType = 'audio/ogg';
        filename = 'voice-message.ogg';
    }
    const type = mediaTypeFor(mimeType);
    const mediaId = await whatsappService.uploadMedia(buffer, mimeType, filename);

    const _id = new Types.ObjectId();
    const message = await WhatsAppMessageModel.create({
        _id,
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.OUTBOUND,
        sender: WhatsAppMessageSender.AGENT,
        type,
        body: type === WhatsAppMessageType.AUDIO ? '' : (options.caption ?? ''),
        media: { id: mediaId, mimeType, filename, voice: options.voice || undefined },
        whatsappMsgId: `pending:${_id}`,
        status: WhatsAppMessageStatus.PENDING,
        clientId: options.clientId,
    });

    conversation.lastMessageAt = new Date();
    conversation.aiEnabled = false;
    await conversation.save();

    await enqueueWhatsAppSend(_id.toString());
    notifyAgents('whatsapp:new_message', { conversationId });

    return toMessageSummary(message);
}

// Only media that belongs to a message in our inbox can be fetched through the proxy.
async function getMedia(mediaId: string) {
    const known = await WhatsAppMessageModel.exists({ 'media.id': mediaId });
    if (!known) return null;
    return whatsappService.downloadMedia(mediaId);
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

// An agent reply switches AI off; this is how they hand the chat back. Turning
// it on also returns an escalated chat to bot mode, since the webhook only lets
// the AI answer conversations in that state (the linked ticket stays open).
async function setAiEnabled(conversationId: string, aiEnabled: boolean): Promise<void> {
    const conversation = await WhatsAppConversationModel.findById(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    conversation.aiEnabled = aiEnabled;
    if (aiEnabled && conversation.status === WhatsAppConversationStatus.ESCALATED) {
        conversation.status = WhatsAppConversationStatus.BOT;
    }
    await conversation.save();
}

async function markConversationRead(conversationId: string): Promise<void> {
    await WhatsAppConversationModel.findByIdAndUpdate(conversationId, { lastReadAt: new Date() });
}

export default {
    listConversations,
    getMessages,
    sendAgentMessage,
    sendAgentMedia,
    getMedia,
    retryMessage,
    setAiEnabled,
    markConversationRead,
};
