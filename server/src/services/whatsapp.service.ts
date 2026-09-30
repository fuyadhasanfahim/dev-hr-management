import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';

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

const messagesPath = () => `${envConfig.whatsapp_phone_number_id}/messages`;
const callsPath = () => `${envConfig.whatsapp_phone_number_id}/calls`;

/**
 * Sends a plain text WhatsApp message and returns Meta's message id for it.
 */
export async function sendTextMessage(to: string, body: string): Promise<string> {
    const data = await graphPost(messagesPath(), { to, type: 'text', text: { body } }, 'send');
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

    const data = await graphPost(messagesPath(), { to, type, [type]: object }, 'send');
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

// ── Calling API ─────────────────────────────────────────────────────────────
// Media flows browser ⇄ Meta over WebRTC; we only relay the SDP offer/answer.

/** Business-initiated call. Returns Meta's call id. */
export async function startCall(to: string, sdpOffer: string): Promise<string> {
    const data = await graphPost(
        callsPath(),
        { to, action: 'connect', session: { sdp_type: 'offer', sdp: sdpOffer } },
        'call',
    );
    return data.calls?.[0]?.id;
}

/** Answers a user-initiated call with the agent browser's SDP answer. */
export async function acceptCall(callId: string, sdpAnswer: string): Promise<void> {
    const session = { sdp_type: 'answer', sdp: sdpAnswer };
    // pre_accept lets WebRTC connect before the call is live, so the first words aren't clipped.
    await graphPost(callsPath(), { call_id: callId, action: 'pre_accept', session }, 'call pre-accept');
    await graphPost(callsPath(), { call_id: callId, action: 'accept', session }, 'call accept');
}

export async function rejectCall(callId: string): Promise<void> {
    await graphPost(callsPath(), { call_id: callId, action: 'reject' }, 'call reject');
}

export async function terminateCall(callId: string): Promise<void> {
    await graphPost(callsPath(), { call_id: callId, action: 'terminate' }, 'call terminate');
}

/**
 * Whether we may call this user right now: they granted permission AND we're
 * under Meta's per-user call limits. `canRequest` = a permission request may be sent.
 */
export async function getCallPermission(userPhone: string): Promise<{ canCall: boolean; canRequest: boolean }> {
    const res = await fetch(
        graphUrl(`${envConfig.whatsapp_phone_number_id}/call_permissions?user_wa_id=${encodeURIComponent(userPhone)}`),
        { headers: authHeader() },
    );
    const data: any = await res.json();
    if (!res.ok) throw new Error(`WhatsApp call permission check failed: ${data?.error?.message || `HTTP ${res.status}`}`);
    const can = (name: string) =>
        (data?.actions ?? []).some((a: any) => a.action_name === name && a.can_perform_action);
    const granted = data?.permission?.status === 'temporary' || data?.permission?.status === 'permanent';
    return { canCall: granted && can('start_call'), canRequest: can('send_call_permission_request') };
}

/** Asks the user (in-chat button) to allow calls from the business. */
export async function sendCallPermissionRequest(to: string, text: string): Promise<string> {
    const data = await graphPost(
        messagesPath(),
        {
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
                type: 'call_permission_request',
                action: { name: 'call_permission_request' },
                body: { text },
            },
        },
        'call permission request',
    );
    return data.messages?.[0]?.id;
}

export default {
    sendTextMessage,
    sendMediaMessage,
    uploadMedia,
    downloadMedia,
    markMessageRead,
    startCall,
    acceptCall,
    rejectCall,
    terminateCall,
    getCallPermission,
    sendCallPermissionRequest,
};
