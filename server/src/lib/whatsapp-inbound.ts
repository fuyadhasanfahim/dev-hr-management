import { WhatsAppMessageType, type IWhatsAppMedia } from '../models/whatsapp-message.model.js';

// Inbound WhatsApp webhook message → what the inbox stores. Kept free of
// service imports so it can be unit-tested without a DB.

export interface InboundContent {
    type: WhatsAppMessageType;
    body: string;
    media?: IWhatsAppMedia;
    whatsappMsgId: string;
}

export interface IncomingMedia {
    id: string;
    mime_type: string;
    caption?: string;
    filename?: string;
    voice?: boolean;
}

export interface IncomingMessage {
    from?: string; // absent when the sender uses a WhatsApp username and hasn't shared a number
    from_user_id?: string; // BSUID, always present once usernames are on
    id: string;
    timestamp: string;
    type: string;
    text?: { body: string };
    image?: IncomingMedia;
    video?: IncomingMedia;
    audio?: IncomingMedia;
    document?: IncomingMedia;
    sticker?: IncomingMedia;
    interactive?: {
        type: string;
        call_permission_reply?: { response: 'accept' | 'reject'; is_permanent?: boolean };
    };
}

// Who to key the conversation on: phone number if Meta sent one, else the BSUID.
export const senderId = (m: { from?: string; from_user_id?: string }) => m.from || m.from_user_id;

// BSUIDs look like "BD.1349…"; phone numbers are digits only.
export const isPhoneId = (id: string) => /^\d+$/.test(id);

const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'] as const;

// Normalises any inbound message into what we store, or null to ignore it
// (reactions, read receipts of buttons, etc.).
export function parseIncoming(message: IncomingMessage): Omit<InboundContent, 'whatsappMsgId'> | null {
    if (message.type === 'text' && message.text?.body) {
        return { type: WhatsAppMessageType.TEXT, body: message.text.body };
    }
    if ((MEDIA_TYPES as readonly string[]).includes(message.type)) {
        const media = message[message.type as (typeof MEDIA_TYPES)[number]];
        if (!media?.id) return null;
        return {
            type: message.type as WhatsAppMessageType,
            body: media.caption ?? '',
            media: { id: media.id, mimeType: media.mime_type, filename: media.filename, voice: media.voice },
        };
    }
    const reply = message.interactive?.call_permission_reply;
    if (message.type === 'interactive' && reply) {
        const body =
            reply.response === 'accept'
                ? `Customer allowed calls${reply.is_permanent ? '' : ' for 7 days'}`
                : 'Customer declined calls';
        return { type: WhatsAppMessageType.CALL, body };
    }
    if (['location', 'contacts', 'unsupported'].includes(message.type)) {
        return { type: WhatsAppMessageType.TEXT, body: `[${message.type} message — open WhatsApp to view]` };
    }
    return null;
}


// A message the business sent from the WhatsApp Business app (coexistence
// `smb_message_echoes`). Echoes also carry edits and deletes made in the app.
export interface EchoMessage extends IncomingMessage {
    to?: string; // the customer
    edit?: { original_message_id?: string; message?: IncomingMessage & { text?: { body: string } } };
    revoke?: { original_message_id?: string };
}

export type ParsedEcho =
    | { kind: 'message'; customer: string; content: Omit<InboundContent, 'whatsappMsgId'>; whatsappMsgId: string }
    | { kind: 'edit'; originalId: string; body: string }
    | { kind: 'revoke'; originalId: string };

// ponytail: edit/revoke field names follow Meta's standard edit/revoke webhooks
// (original_message_id); Meta's echo docs don't spell the JSON out, so an echo
// we can't read is dropped (and logged by the caller) rather than guessed at.
export function parseEcho(echo: EchoMessage): ParsedEcho | null {
    if (echo.type === 'revoke') {
        const originalId = echo.revoke?.original_message_id;
        return originalId ? { kind: 'revoke', originalId } : null;
    }
    if (echo.type === 'edit') {
        const originalId = echo.edit?.original_message_id;
        const body = echo.edit?.message?.text?.body ?? echo.edit?.message?.[(echo.edit.message.type as 'image')]?.caption;
        return originalId && body !== undefined ? { kind: 'edit', originalId, body } : null;
    }
    const content = parseIncoming(echo);
    const customer = echo.to;
    return content && customer && echo.id ? { kind: 'message', customer, content, whatsappMsgId: echo.id } : null;
}
