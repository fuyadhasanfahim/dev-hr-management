import TicketModel from '../models/ticket.model.js';
import TicketMessageModel, { MessageSenderModel } from '../models/ticket-message.model.js';
import { AppError } from '../utils/AppError.js';
import attachmentService from './attachment.service.js';
import { generatePresignedViewUrl } from './s3-upload.service.js';
import { isLockedStatus } from './support-ticket.service.js';

// The customer's side of a ticket, reached with the private link emailed to them. The token is 144 random bits and is
// the only key, so what comes back is limited to what the customer should see: no internal notes, no staff identities,
// no AI memory or chat transcript, no attachments.

export const MAX_CUSTOMER_MESSAGE = 2000;
const MAX_ATTACHMENTS = 5;
const PLACEHOLDER = '(attachment)';
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const INTERNAL_MARKERS = ['--- Chat Transcript ---', '--- Prior AI Chat ---', 'What the AI knows about the visitor:'];

/** The ticket's first message carries the AI chat transcript and memory for staff: cut them off. */
function publicBody(text: string): string {
    let end = text.length;
    for (const m of INTERNAL_MARKERS) {
        const i = text.indexOf(m);
        if (i !== -1 && i < end) end = i;
    }
    return text.slice(0, end).trim();
}

async function findByToken(token: string, select = '') {
    if (!TOKEN_RE.test(token)) throw new AppError('Ticket not found', 404);
    const ticket: any = await TicketModel.findOne({ publicToken: token }).select(`ticketId subject status category visitorName createdAt updatedAt clientId guestId ${select}`);
    if (!ticket) throw new AppError('Ticket not found', 404);
    return ticket;
}

const CHAT_HEADER = /^\[System: Converted from Support Live Chat\]/;
const CHAT_LINE = /^\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]\s+(Client|Guest|Agent)\s+\(([^)]*)\):\s?(.*)$/;

/**
 * A ticket opened from a live chat starts with a system header, the agent's internal reason and the chat as plain
 * lines. The customer sees the chat as the messages it was; the header and the internal reason never leave the server.
 */
function chatMessages(content: string): { id: string; from: 'you' | 'team'; text: string; attachments: string[]; createdAt: string }[] {
    const lines = content.slice(content.indexOf('Chat Transcript:') + 'Chat Transcript:'.length).split('\n');
    const out: { id: string; from: 'you' | 'team'; text: string; attachments: string[]; createdAt: string; name: string }[] = [];
    for (const line of lines) {
        const m = line.match(CHAT_LINE);
        if (m) {
            out.push({ id: `chat-${out.length}`, from: m[2] === 'Agent' ? 'team' : 'you', text: m[4]!, attachments: [], createdAt: new Date(m[1]!).toISOString(), name: m[3]! });
        } else if (out.length && line.trim()) {
            out[out.length - 1]!.text += `\n${line}`; // a message that had line breaks
        }
    }
    // Notes the system wrote into the chat (joined, resolved, ticket opened) are not conversation.
    return out.filter((m) => m.name !== 'System' && m.text.trim()).map(({ name: _name, ...rest }) => rest);
}

export async function getThread(token: string) {
    const ticket = await findByToken(token);
    const messages: any[] = await TicketMessageModel.find({ ticketId: ticket._id, isInternalNote: { $ne: true } })
        .sort({ createdAt: 1 })
        .limit(300)
        .select('senderModel content attachments createdAt')
        .lean();
    const first = messages[0];
    const fromChat = !!first && CHAT_HEADER.test(first.content ?? '');
    const chatLines = fromChat ? chatMessages(first.content) : [];

    return {
        ticket: {
            ticketId: ticket.ticketId,
            subject: ticket.subject,
            status: ticket.status,
            category: ticket.category,
            firstName: String(ticket.visitorName ?? '').trim().split(/\s+/)[0] || null,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
        },
        messages: [
            ...chatLines,
            ...messages
            .filter((_m, i) => !(fromChat && i === 0))
            .map((m, i) => ({
                id: String(m._id),
                from: m.senderModel === MessageSenderModel.STAFF ? ('team' as const) : ('you' as const),
                text: m.content === PLACEHOLDER ? '' : i === 0 && !fromChat ? publicBody(m.content) : m.content,
                attachments: (m.attachments ?? []) as string[],
                createdAt: m.createdAt,
            }))
            .filter((m) => m.text || m.attachments.length > 0),
        ],
    };
}

/** The customer writes on their ticket. Closed tickets stay closed; a resolved one is reopened by a new message. */
export async function postCustomerMessage(token: string, rawText: unknown, rawAttachments: unknown = []) {
    const text = typeof rawText === 'string' ? rawText.trim() : '';
    const list = Array.isArray(rawAttachments) ? rawAttachments.filter((a): a is string => typeof a === 'string') : [];
    if (!text && list.length === 0) throw new AppError('Write a message first.', 400);
    if (list.length > MAX_ATTACHMENTS) throw new AppError(`You can attach up to ${MAX_ATTACHMENTS} files at a time.`, 400);
    if (text.length > MAX_CUSTOMER_MESSAGE) throw new AppError(`Messages can be up to ${MAX_CUSTOMER_MESSAGE} characters.`, 400);

    const ticket = await findByToken(token);
    if (isLockedStatus(ticket.status)) throw new AppError(`This ticket is ${ticket.status}, so new messages can't be added. If you still need help, please start a new ticket.`, 409);

    // Only files uploaded to this very ticket can be attached to it.
    const prefix = `tickets/${ticket._id}/`;
    const attachments = list.map((a) => {
        const key = keyOf(a);
        if (!key || !key.startsWith(prefix) || key.includes('..')) throw new AppError('One of the attachments is not valid.', 400);
        return a;
    });

    const isClient = !!ticket.clientId;
    const message = await TicketMessageModel.create({
        ticketId: ticket._id,
        senderModel: isClient ? MessageSenderModel.CLIENT : MessageSenderModel.GUEST,
        ...(isClient ? { senderId: ticket.clientId } : ticket.guestId ? { senderId: ticket.guestId } : {}),
        senderName: ticket.visitorName || 'Customer',
        content: text || PLACEHOLDER,
        attachments,
    });

    // Nobody has picked an open ticket up yet, so a customer message doesn't make it "in progress".
    if (ticket.status === 'pending_client') ticket.status = 'in_progress';
    ticket.staffUnread = (ticket.staffUnread ?? 0) + 1;
    await ticket.save();
    return { ticketMongoId: String(ticket._id), message: { id: String(message._id), from: 'you' as const, text, attachments, createdAt: message.createdAt } };
}

/** The S3 key inside an attachment value: a bare key, or the object URL we stored. */
function keyOf(value: string): string | null {
    if (value.startsWith('tickets/')) return value;
    try {
        const u = new URL(value);
        if (!u.hostname.endsWith('.amazonaws.com')) return null;
        const path = decodeURIComponent(u.pathname.replace(/^\//, ''));
        return path.startsWith('tickets/') ? path : null;
    } catch {
        return null;
    }
}

/** A presigned upload URL for a file the customer wants to attach. Same type and size rules as everywhere else. */
export async function requestCustomerUpload(token: string, file: { fileName?: unknown; fileType?: unknown; fileSize?: unknown }) {
    const ticket = await findByToken(token);
    if (isLockedStatus(ticket.status)) throw new AppError(`This ticket is ${ticket.status}.`, 409);
    const fileName = typeof file.fileName === 'string' ? file.fileName.slice(0, 200) : '';
    const fileType = typeof file.fileType === 'string' ? file.fileType : '';
    const fileSize = Number(file.fileSize);
    if (!fileName || !fileType || !Number.isFinite(fileSize) || fileSize <= 0) throw new AppError('Choose a file to attach.', 400);
    return attachmentService.requestPresignedUrl({ fileName, fileType, fileSize, folder: 'tickets', referenceId: String(ticket._id) });
}

/** A short-lived link to view one file of this ticket (the bucket is private). */
export async function getCustomerViewUrl(token: string, fileKey: unknown, download = false) {
    const ticket = await findByToken(token);
    const key = typeof fileKey === 'string' ? keyOf(fileKey) : null;
    if (!key || !key.startsWith(`tickets/${ticket._id}/`) || key.includes('..')) throw new AppError('File not found.', 404);
    return { viewUrl: await generatePresignedViewUrl(key, download ? { download: true } : undefined) };
}

export default { getThread, postCustomerMessage, requestCustomerUpload, getCustomerViewUrl };
