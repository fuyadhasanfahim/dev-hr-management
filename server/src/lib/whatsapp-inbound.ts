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
    from: string;
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

