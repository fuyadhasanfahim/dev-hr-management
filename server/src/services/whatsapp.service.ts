import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import { isPhoneId } from '../lib/whatsapp-inbound.js';

function graphUrl(path: string): string {
    return `https://graph.facebook.com/${envConfig.meta_api_version}/${path}`;
}

// Meta's error text: message, plus the more specific details and code when present.
function graphErrorText(data: any, status: number): string {
    const e = data?.error;
    if (!e) return `HTTP ${status}`;
    const details = e.error_data?.details;
    return `${e.message ?? `HTTP ${status}`}${details && details !== e.message ? ` — ${details}` : ''}${e.code ? ` (#${e.code})` : ''}`;
}

const authHeader = () => ({ Authorization: `Bearer ${envConfig.meta_access_token}` });

// POSTs JSON to the Graph API and throws Meta's own error text on failure.
async function graphPost(path: string, payload: Record<string, unknown>, what: string): Promise<any> {
    const res = await fetch(graphUrl(path), {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(`WhatsApp ${what} failed: ${graphErrorText(data, res.status)}`);
    return data;
}

// Phone numbers go in `to`; username-only users (BSUID) go in `recipient`.
const target = (id: string) => (isPhoneId(id) ? { to: id } : { recipient: id });

const messagesPath = () => `${envConfig.whatsapp_phone_number_id}/messages`;

/**
 * Sends a plain text WhatsApp message and returns Meta's message id for it.
 */
export async function sendTextMessage(to: string, body: string): Promise<string> {
    const data = await graphPost(messagesPath(), { ...target(to), type: 'text', text: { body } }, 'send');
    return data.messages?.[0]?.id;
}

/**
 * Sends an approved template message (the only kind WhatsApp allows outside the 24h window).
 * `params` fill the template body's {{1}}, {{2}}… in order.
 */
export async function sendTemplateMessage(
    to: string,
    name: string,
    language: string,
    params: string[],
    // For templates with a dynamic URL button ("https://site/path/{{1}}"): the value that fills {{1}}.
    urlButtonParam?: string,
): Promise<string> {
    const data = await graphPost(
        messagesPath(),
        {
            ...target(to),
            type: 'template',
            template: {
                name,
                language: { code: language },
                components: [
                    { type: 'body', parameters: params.map((text) => ({ type: 'text', text })) },
                    ...(urlButtonParam ? [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: urlButtonParam }] }] : []),
                ],
            },
        },
        'template send',
    );
    return data.messages?.[0]?.id;
}

export type OutboundMediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

/**
 * Sends an already-uploaded media file (by Meta media id). Captions only apply
 * to image/video/document; `voice` marks an ogg/opus audio as a voice note.
 */
export async function sendMediaMessage(
    to: string,
    type: OutboundMediaType,
    media: { id: string; caption?: string; filename?: string; voice?: boolean },
): Promise<string> {
    const object: Record<string, unknown> = { id: media.id };
    if (media.caption && type !== 'audio' && type !== 'sticker') object.caption = media.caption;
    if (type === 'document' && media.filename) object.filename = media.filename;
    if (type === 'audio' && media.voice) object.voice = true;

    const data = await graphPost(messagesPath(), { ...target(to), type, [type]: object }, 'send');
    return data.messages?.[0]?.id;
}

/**
 * Uploads a file to Meta and returns its media id (valid for 30 days).
 */
export async function uploadMedia(file: Buffer, mimeType: string, filename: string): Promise<string> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    form.append('file', new Blob([new Uint8Array(file)], { type: mimeType }), filename);

    const res = await fetch(graphUrl(`${envConfig.whatsapp_phone_number_id}/media`), {
        method: 'POST',
        headers: authHeader(),
        body: form,
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(`WhatsApp media upload failed: ${graphErrorText(data, res.status)}`);
    return data.id;
}

/**
 * Fetches a media file from Meta. Two hops: the media id resolves to a
 * short-lived URL, which itself needs the bearer token to download.
 */
export async function downloadMedia(mediaId: string): Promise<{ body: ReadableStream<Uint8Array>; mimeType: string; size?: string }> {
    const infoRes = await fetch(graphUrl(mediaId), { headers: authHeader() });
    const info: any = await infoRes.json();
    if (!infoRes.ok || !info.url) throw new Error(`WhatsApp media lookup failed: ${info?.error?.message || `HTTP ${infoRes.status}`}`);

    const fileRes = await fetch(info.url, { headers: authHeader() });
    if (!fileRes.ok || !fileRes.body) throw new Error(`WhatsApp media download failed: HTTP ${fileRes.status}`);
    return { body: fileRes.body, mimeType: info.mime_type, size: fileRes.headers.get('content-length') ?? undefined };
}

/**
 * Marks an inbound message as read (blue ticks) — best-effort, never throws.
 */
export async function markMessageRead(whatsappMsgId: string): Promise<void> {
    try {
        await graphPost(messagesPath(), { status: 'read', message_id: whatsappMsgId }, 'mark read');
    } catch (err: any) {
        logger.warn(`Failed to mark WhatsApp message ${whatsappMsgId} as read: ${err.message}`);
    }
}

export default {
    sendTextMessage,
    sendTemplateMessage,
    sendMediaMessage,
    uploadMedia,
    downloadMedia,
    markMessageRead,
};
