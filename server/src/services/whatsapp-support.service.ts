import { Types } from 'mongoose';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import WhatsAppConversationModel, {
    WhatsAppConversationStatus,
    type IWhatsAppAssignee,
} from '../models/whatsapp-conversation.model.js';
import WhatsAppNoteModel from '../models/whatsapp-note.model.js';
import ClientModel from '../models/client.model.js';
import LeadModel from '../models/lead.model.js';
import { escapeRegex } from '../lib/sanitize.js';
import leadService from './lead.service.js';
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

/** An inbox rule the agent hit (assignment, permission…) — carries its own HTTP status. */
export class InboxError extends Error {
    constructor(message: string, public status: number, public code?: string, public extra?: Record<string, unknown>) {
        super(message);
    }
}

/** The signed-in agent acting on the inbox. */
export interface Agent {
    id: string;
    name: string;
    canManage: boolean; // support.manage — may take over another agent's chat
}

/**
 * Makes `agent` the chat's handler if nobody is, atomically — two agents
 * replying at the same moment can't both win. Throws if someone else has it.
 */
export async function claimConversation(conversationId: string, agent: Agent) {
    const conversation = await WhatsAppConversationModel.findOneAndUpdate(
        { _id: conversationId, $or: [{ assignedTo: null }, { 'assignedTo.id': agent.id }] },
        { $set: { assignedTo: { id: agent.id, name: agent.name } } },
        { new: false }, // the pre-update doc tells us whether this was a fresh claim
    );
    if (conversation) {
        if (!conversation.assignedTo?.id) {
            const assignedAt = new Date();
            await WhatsAppConversationModel.updateOne({ _id: conversationId }, { assignedAt });
            conversation.assignedTo = { id: agent.id, name: agent.name };
            conversation.assignedAt = assignedAt;
            notifyAgents('whatsapp:conversation_updated', { conversationId });
        }
        return conversation;
    }

    const existing = await WhatsAppConversationModel.findById(conversationId).select('assignedTo').lean();
    if (!existing) throw new InboxError('Conversation not found', 404);
    throw new InboxError(`${existing.assignedTo?.name ?? 'Another agent'} is already handling this chat`, 409, 'ASSIGNED', {
        assignedTo: existing.assignedTo,
    });
}

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
    const conversation = await WhatsAppConversationModel.create({
        customerPhone,
        customerName,
        status: WhatsAppConversationStatus.BOT,
    });
    // A new person writing in is a new lead (skipped if we already know the number).
    void leadService.createLeadFromWhatsApp(customerPhone, customerName);
    return conversation;
}

const PREVIEW_LABEL: Record<string, string> = {
    image: '📷 Photo',
    video: '🎥 Video',
    audio: '🎵 Audio',
    document: '📄 Document',
    sticker: 'Sticker',
};

// Chat-list preview line, WhatsApp style: caption if there is one, else a label.
export function previewText(m: { type?: string; body: string; media?: { voice?: boolean; filename?: string } | null }): string {
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
    assignedTo: IWhatsAppAssignee | null;
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
            assignedTo: c.assignedTo?.id ? { id: c.assignedTo.id, name: c.assignedTo.name } : null,
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
async function sendAgentMessage(conversationId: string, body: string, agent: Agent, clientId?: string): Promise<MessageSummary> {
    const conversation = await claimConversation(conversationId, agent);

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

    touchAfterAgentReply(conversation);
    await conversation.save();

    await enqueueWhatsAppSend(_id.toString());
    notifyAgents('whatsapp:new_message', { conversationId });

    return toMessageSummary(message);
}

// Replying means the agent has read everything so far, and that the bot
// should stay quiet on this chat from now on.
function touchAfterAgentReply(conversation: { lastMessageAt: Date; lastReadAt: Date; aiEnabled: boolean }) {
    const now = new Date();
    conversation.lastMessageAt = now;
    conversation.lastReadAt = now;
    conversation.aiEnabled = false;
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
    agent: Agent,
): Promise<MessageSummary> {
    const conversation = await claimConversation(conversationId, agent);

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

    touchAfterAgentReply(conversation);
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
// Handing a chat back to the AI also releases it, so the bot owns it again.
async function setAiEnabled(conversationId: string, aiEnabled: boolean, agent: Agent): Promise<void> {
    const conversation = await WhatsAppConversationModel.findById(conversationId);
    if (!conversation) throw new InboxError('Conversation not found', 404);
    assertCanAct(conversation.assignedTo, agent);
    conversation.aiEnabled = aiEnabled;
    if (aiEnabled) {
        if (conversation.status === WhatsAppConversationStatus.ESCALATED) conversation.status = WhatsAppConversationStatus.BOT;
        conversation.assignedTo = null;
        conversation.assignedAt = null;
    }
    await conversation.save();
    notifyAgents('whatsapp:conversation_updated', { conversationId });
}

function assertCanAct(assignedTo: IWhatsAppAssignee | null | undefined, agent: Agent) {
    if (assignedTo?.id && assignedTo.id !== agent.id && !agent.canManage) {
        throw new InboxError(`${assignedTo.name} is handling this chat`, 409, 'ASSIGNED', { assignedTo });
    }
}

/**
 * claim   — take an unassigned chat (or, with support.manage, someone else's)
 * release — let go of your chat (managers can release anyone's)
 */
async function setAssignment(conversationId: string, action: 'claim' | 'release', agent: Agent): Promise<void> {
    const conversation = await WhatsAppConversationModel.findById(conversationId);
    if (!conversation) throw new InboxError('Conversation not found', 404);
    assertCanAct(conversation.assignedTo, agent);

    if (action === 'claim') {
        const takingOver = conversation.assignedTo?.id !== agent.id;
        conversation.assignedTo = { id: agent.id, name: agent.name };
        if (takingOver) conversation.assignedAt = new Date();
        conversation.aiEnabled = false; // A human owns it now.
    } else {
        conversation.assignedTo = null;
        conversation.assignedAt = null;
    }
    await conversation.save();
    notifyAgents('whatsapp:conversation_updated', { conversationId });
}

// Read state is shared by the team (one inbox), so everyone's badge updates live.
async function markConversationRead(conversationId: string): Promise<void> {
    await WhatsAppConversationModel.findByIdAndUpdate(conversationId, { lastReadAt: new Date() });
    notifyAgents('whatsapp:conversation_updated', { conversationId });
}

// ── Info panel: notes + customer details ─────────────────────────────────────

export interface NoteSummary {
    id: string;
    body: string;
    author: { id: string; name: string };
    createdAt: string;
}

async function phoneOf(conversationId: string): Promise<string> {
    const conversation = await WhatsAppConversationModel.findById(conversationId).select('customerPhone').lean();
    if (!conversation) throw new InboxError('Conversation not found', 404);
    return conversation.customerPhone;
}

async function listNotes(conversationId: string): Promise<NoteSummary[]> {
    const notes = await WhatsAppNoteModel.find({ customerPhone: await phoneOf(conversationId) }).sort({ createdAt: -1 }).lean();
    return notes.map((n) => ({ id: n._id.toString(), body: n.body, author: n.author, createdAt: n.createdAt.toISOString() }));
}

async function addNote(conversationId: string, body: string, agent: Agent): Promise<NoteSummary> {
    const note = await WhatsAppNoteModel.create({
        customerPhone: await phoneOf(conversationId),
        body,
        author: { id: agent.id, name: agent.name },
    });
    notifyAgents('whatsapp:notes_updated', { conversationId });
    return { id: note._id.toString(), body: note.body, author: note.author, createdAt: note.createdAt.toISOString() };
}

// Authors delete their own notes; managers can delete any.
async function deleteNote(conversationId: string, noteId: string, agent: Agent): Promise<void> {
    const filter: Record<string, unknown> = { _id: noteId, customerPhone: await phoneOf(conversationId) };
    if (!agent.canManage) filter['author.id'] = agent.id;
    const { deletedCount } = await WhatsAppNoteModel.deleteOne(filter);
    if (!deletedCount) throw new InboxError('Note not found, or it isn’t yours to delete', 404);
    notifyAgents('whatsapp:notes_updated', { conversationId });
}

const lastDigits = (phone: string, n = 10) => phone.replace(/\D/g, '').slice(-n);

// Phones are stored however staff typed them ("+880 17…", "017…"), so match
// on the last 10 digits after a cheap regex pre-filter on the last 4.
async function findByPhone<T extends { phone?: string }>(model: any, phone: string, select: string): Promise<T | null> {
    const tail = lastDigits(phone);
    if (tail.length < 7) return null;
    const candidates: T[] = await model
        .find({ phone: { $regex: escapeRegex(tail.slice(-4)) } })
        .select(select)
        .limit(50)
        .lean();
    return candidates.find((c) => c.phone && lastDigits(c.phone) === tail) ?? null;
}

async function getCustomerDetails(conversationId: string) {
    const conversation = await WhatsAppConversationModel.findById(conversationId).lean();
    if (!conversation) throw new InboxError('Conversation not found', 404);

    const [client, lead, firstMessage, messageCount, conversationCount] = await Promise.all([
        findByPhone<any>(ClientModel, conversation.customerPhone, 'clientId name emails phone status currency address createdAt'),
        findByPhone<any>(LeadModel, conversation.customerPhone, 'name email phone status source createdAt'),
        WhatsAppMessageModel.findOne({ conversationId }).sort({ createdAt: 1 }).select('createdAt').lean(),
        WhatsAppMessageModel.countDocuments({ conversationId }),
        WhatsAppConversationModel.countDocuments({ customerPhone: conversation.customerPhone }),
    ]);

    return {
        name: conversation.customerName ?? null,
        phone: conversation.customerPhone,
        status: conversation.status,
        aiEnabled: conversation.aiEnabled,
        assignedTo: conversation.assignedTo?.id ? conversation.assignedTo : null,
        assignedAt: conversation.assignedAt?.toISOString() ?? null,
        firstContactAt: (firstMessage?.createdAt ?? conversation.createdAt).toISOString(),
        messageCount,
        conversationCount,
        linkedTicketId: conversation.linkedTicketId?.toString() ?? null,
        client: client
            ? {
                  id: client._id.toString(),
                  clientId: client.clientId ?? null,
                  name: client.name,
                  email: client.emails?.[0] ?? null,
                  status: client.status,
                  currency: client.currency ?? null,
                  address: client.address ?? null,
                  since: client.createdAt?.toISOString() ?? null,
              }
            : null,
        lead: lead
            ? {
                  id: lead._id.toString(),
                  name: lead.name,
                  email: lead.email ?? null,
                  status: lead.status,
                  source: lead.source ?? null,
              }
            : null,
    };
}

export default {
    listConversations,
    getMessages,
    sendAgentMessage,
    sendAgentMedia,
    getMedia,
    retryMessage,
    setAiEnabled,
    setAssignment,
    markConversationRead,
    listNotes,
    addNote,
    deleteNote,
    getCustomerDetails,
};
