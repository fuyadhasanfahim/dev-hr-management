import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import { sendBulkSMS } from '../utils/sms.util.js';
import { isBdMobile, toWhatsAppNumber } from '../utils/phone.util.js';
import whatsappService from './whatsapp.service.js';
import emailService from './email.service.js';
import WhatsAppConversationModel from '../models/whatsapp-conversation.model.js';
import WhatsAppMessageModel, { WhatsAppMessageDirection } from '../models/whatsapp-message.model.js';

// One place that tells a person something on every channel we have — SMS, WhatsApp, email — for order status
// updates (clients) and attendance/leave alerts (staff).
//
// Hard rule: this NEVER throws and never waits on the caller's request. Each channel runs on its own; a bad
// number, a gateway outage or a missing credential is logged and reported in the result, nothing more. The
// feature that triggered the message (changing an order's status, marking attendance) must work whether or
// not any message could be sent.

export interface Recipient {
    name?: string | null;
    phone?: string | null;
    email?: string | string[] | null;
}

export interface Notice {
    /** Log tag, e.g. "order.status" or "attendance.absent". */
    event: string;
    /** The message as plain text — SMS body, WhatsApp text and the email sentence. */
    text: string;
    /** Email subject and heading. */
    subject: string;
    /** Approved WhatsApp template (name from env) + its {{1}}, {{2}}… values. Unset → free text inside the 24h window. */
    whatsappTemplate?: { name: string; params: string[] };
    actionUrl?: string;
    actionLabel?: string;
    /** Email "from" label. */
    emailFrom?: string;
}

export type ChannelResult = 'sent' | `skipped: ${string}` | `failed: ${string}`;
export interface NotifyResult {
    sms: ChannelResult;
    whatsapp: ChannelResult;
    email: ChannelResult;
}

const WINDOW_MS = 23 * 3600_000; // Meta allows free text for 24h after the customer's last message; stay a little inside it.
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

async function viaSms(phone: string | null, notice: Notice): Promise<ChannelResult> {
    if (!envConfig.sms_api_key) return 'skipped: SMS_API_KEY not set';
    if (!isBdMobile(phone)) return 'skipped: not a Bangladeshi mobile number';
    const res = await sendBulkSMS({ number: phone, message: notice.text });
    // BulkSMSBD answers response_code 202 when the SMS is accepted.
    return res.response_code === 202 ? 'sent' : `failed: ${res.success_message || res.error || `code ${res.response_code}`}`;
}

async function insideFreeTextWindow(phone: string): Promise<boolean> {
    const conversation = await WhatsAppConversationModel.findOne({ customerPhone: phone }).select('_id').lean();
    if (!conversation) return false;
    const last = await WhatsAppMessageModel.findOne({ conversationId: conversation._id, direction: WhatsAppMessageDirection.INBOUND })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean();
    return !!last && Date.now() - new Date(last.createdAt).getTime() < WINDOW_MS;
}

async function viaWhatsApp(phone: string | null, notice: Notice): Promise<ChannelResult> {
    if (!envConfig.meta_access_token || !envConfig.whatsapp_phone_number_id) return 'skipped: WhatsApp not configured';
    if (!phone) return 'skipped: no phone number';
    const tpl = notice.whatsappTemplate;
    if (tpl?.name) {
        await whatsappService.sendTemplateMessage(phone, tpl.name, envConfig.wa_template_language, tpl.params);
        return 'sent';
    }
    // No approved template: WhatsApp only allows free text to someone who wrote to us in the last 24 hours.
    if (await insideFreeTextWindow(phone)) {
        await whatsappService.sendTextMessage(phone, notice.text);
        return 'sent';
    }
    return 'skipped: no approved template and customer is outside the 24h window';
}

async function viaEmail(r: Recipient, notice: Notice): Promise<ChannelResult> {
    const to = (Array.isArray(r.email) ? r.email : [r.email]).filter((e): e is string => !!e && e.includes('@'));
    if (!to.length) return 'skipped: no email address';
    await emailService.sendNotificationEmail({
        to,
        ...(notice.emailFrom ? { from: notice.emailFrom } : {}),
        subject: notice.subject,
        heading: notice.subject,
        greeting: `Hi ${r.name || 'there'},`,
        body: notice.text,
        ...(notice.actionUrl ? { actionUrl: notice.actionUrl, actionLabel: notice.actionLabel || 'Open' } : {}),
    });
    return 'sent';
}

async function settle(channel: string, event: string, run: () => Promise<ChannelResult>): Promise<ChannelResult> {
    try {
        return await run();
    } catch (e) {
        logger.warn({ event, channel, err: errText(e) }, 'notify.channel_failed');
        return `failed: ${errText(e)}`;
    }
}

/**
 * Sends `notice` to `recipient` on SMS, WhatsApp and email at the same time. Resolves with what happened on each
 * channel; never rejects. In `dry` mode (the default outside production) nothing is sent — it only logs.
 */
export async function notify(recipient: Recipient, notice: Notice): Promise<NotifyResult> {
    try {
        const phone = toWhatsAppNumber(recipient.phone);
        if (envConfig.notify_mode !== 'live') {
            logger.info({ event: notice.event, to: recipient.name, phone, text: notice.text }, 'notify.dry_run');
            const dry: ChannelResult = 'skipped: NOTIFY_MODE is dry';
            return { sms: dry, whatsapp: dry, email: dry };
        }
        const [sms, whatsapp, email] = await Promise.all([
            settle('sms', notice.event, () => viaSms(phone, notice)),
            settle('whatsapp', notice.event, () => viaWhatsApp(phone, notice)),
            settle('email', notice.event, () => viaEmail(recipient, notice)),
        ]);
        logger.info({ event: notice.event, to: recipient.name, sms, whatsapp, email }, 'notify.done');
        return { sms, whatsapp, email };
    } catch (e) {
        logger.error({ event: notice.event, err: errText(e) }, 'notify.unexpected');
        const failed: ChannelResult = `failed: ${errText(e)}`;
        return { sms: failed, whatsapp: failed, email: failed };
    }
}

export default { notify };
