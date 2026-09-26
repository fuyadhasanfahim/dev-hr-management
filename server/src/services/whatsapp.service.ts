import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';

function graphUrl(path: string): string {
    return `https://graph.facebook.com/${envConfig.meta_api_version}/${path}`;
}

/**
 * Sends a plain text WhatsApp message and returns Meta's message id for it.
 */
export async function sendTextMessage(to: string, body: string): Promise<string> {
    const res = await fetch(graphUrl(`${envConfig.whatsapp_phone_number_id}/messages`), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${envConfig.meta_access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body },
        }),
    });

    const data: any = await res.json();
    if (!res.ok) {
        throw new Error(`WhatsApp send failed: ${res.status} ${JSON.stringify(data)}`);
    }
    return data.messages?.[0]?.id;
}

/**
 * Marks an inbound message as read (blue ticks) — best-effort, never throws.
 */
export async function markMessageRead(whatsappMsgId: string): Promise<void> {
    try {
        const res = await fetch(graphUrl(`${envConfig.whatsapp_phone_number_id}/messages`), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${envConfig.meta_access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: whatsappMsgId,
            }),
        });
        if (!res.ok) {
            logger.warn(`Failed to mark WhatsApp message ${whatsappMsgId} as read: ${res.status}`);
        }
    } catch (err: any) {
        logger.warn(`Failed to mark WhatsApp message ${whatsappMsgId} as read: ${err.message}`);
    }
}

export default { sendTextMessage, markMessageRead };
