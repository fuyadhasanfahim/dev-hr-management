import axios from 'axios';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';

function graphUrl(path: string): string {
    return `https://graph.facebook.com/${envConfig.whatsapp_api_version}/${path}`;
}

function authHeader() {
    if (!envConfig.whatsapp_access_token) {
        throw new Error('WHATSAPP_ACCESS_TOKEN is not set');
    }
    return { Authorization: `Bearer ${envConfig.whatsapp_access_token}` };
}

// Free-form text reply — only valid within the 24h customer service window.
export async function sendTextMessage(to: string, body: string): Promise<string | undefined> {
    if (!envConfig.whatsapp_phone_number_id) {
        throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set');
    }
    const res = await axios.post(
        graphUrl(`${envConfig.whatsapp_phone_number_id}/messages`),
        {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body, preview_url: false },
        },
        { headers: authHeader() },
    );
    return res.data?.messages?.[0]?.id;
}

// Approved template message — required to (re)open a conversation outside the 24h window,
// e.g. notifying a customer their query is being picked up by a human after a delay.
export async function sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode = 'en_US',
    components?: unknown[],
): Promise<string | undefined> {
    if (!envConfig.whatsapp_phone_number_id) {
        throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set');
    }
    const res = await axios.post(
        graphUrl(`${envConfig.whatsapp_phone_number_id}/messages`),
        {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: templateName,
                language: { code: languageCode },
                ...(components ? { components } : {}),
            },
        },
        { headers: authHeader() },
    );
    return res.data?.messages?.[0]?.id;
}

export async function markMessageRead(whatsappMsgId: string): Promise<void> {
    if (!envConfig.whatsapp_phone_number_id) return;
    try {
        await axios.post(
            graphUrl(`${envConfig.whatsapp_phone_number_id}/messages`),
            { messaging_product: 'whatsapp', status: 'read', message_id: whatsappMsgId },
            { headers: authHeader() },
        );
    } catch (err: any) {
        logger.warn(`Failed to mark WhatsApp message ${whatsappMsgId} as read: ${err.message}`);
    }
}

export default { sendTextMessage, sendTemplateMessage, markMessageRead };
