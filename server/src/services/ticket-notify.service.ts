import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import TicketModel, { TicketSource } from '../models/ticket.model.js';
import WhatsAppConversationModel from '../models/whatsapp-conversation.model.js';
import WhatsAppMessageModel, {
    WhatsAppMessageDirection,
    WhatsAppMessageSender,
    WhatsAppMessageStatus,
    WhatsAppMessageType,
} from '../models/whatsapp-message.model.js';
import { normalizePhone } from './contact.service.js';
import { findOrCreateConversation } from './whatsapp-support.service.js';
import * as whatsappService from './whatsapp.service.js';

// When a ticket is raised for someone who can be reached on WhatsApp, tell them its number with a link to a page
// that shows its current state. The conversation about the ticket then carries on in the same WhatsApp chat.

const WINDOW_MS = 24 * 60 * 60 * 1000;
const BENGALI = /[ঀ-৿]/;

export const trackingUrl = (token: string) => `${envConfig.ticket_link_base}/ticket/${token}`;

/** The number to message: the WhatsApp number we know, else the phone they gave if they said it is on WhatsApp. */
export function whatsappNumberOf(t: {
    whatsappPhone?: string | null;
    visitorPhone?: string | null;
    visitorIsWhatsapp?: boolean | null;
    contactId?: { whatsappPhone?: string | null } | null;
}): string {
    return normalizePhone(t.whatsappPhone || (t.visitorIsWhatsapp ? t.visitorPhone : '') || t.contactId?.whatsappPhone);
}

export async function insideFreeTextWindow(conversationId: Types.ObjectId): Promise<boolean> {
    const last = await WhatsAppMessageModel.findOne({ conversationId, direction: WhatsAppMessageDirection.INBOUND })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean();
    return !!last && Date.now() - new Date(last.createdAt).getTime() < WINDOW_MS;
}

/** Tickets that predate tracking links get a token the first time one is needed. */
export async function ensurePublicToken(ticketId: Types.ObjectId | string): Promise<string> {
    const doc: any = await TicketModel.findById(ticketId).select('publicToken');
    if (doc?.publicToken) return doc.publicToken;
    const token = randomBytes(18).toString('base64url');
    await TicketModel.updateOne({ _id: ticketId }, { $set: { publicToken: token } });
    return token;
}

/**
 * Sends the "your ticket is created" message. Free text with the link when the customer wrote to us in the last
 * 24 hours (always true for tickets raised from a WhatsApp chat), otherwise the approved template with a
 * "Track ticket" button. Best effort: never throws, because the ticket already exists.
 */
export async function notifyTicketCreated(ticketId: Types.ObjectId | string): Promise<void> {
    try {
        if (!envConfig.meta_access_token || !envConfig.whatsapp_phone_number_id) return;
        const ticket: any = await TicketModel.findById(ticketId).populate('contactId', 'whatsappPhone name').lean();
        if (!ticket || ticket.whatsappNotifiedAt) return;
        // A live chat has its own conversation going: it doesn't need a "ticket raised" message.
        if (ticket.source === TicketSource.LIVE_CHAT) return;
        const phone = whatsappNumberOf(ticket);
        if (!phone) return;

        const token = await ensurePublicToken(ticket._id);
        const name: string = ticket.visitorName || ticket.contactId?.name || '';
        const first = name.trim().split(/\s+/)[0] || 'there';
        const bengali = BENGALI.test(`${ticket.subject} ${name}`);
        const link = trackingUrl(token);

        const conversation = await findOrCreateConversation(phone, name || undefined);
        let body: string;
        let messageId: string;
        if (await insideFreeTextWindow(conversation._id)) {
            body = bengali
                ? `${first}, আপনার টিকেট ${ticket.ticketId} খোলা হয়েছে।\nবর্তমান অবস্থা দেখুন: ${link}\n\nটিকেট নিয়ে আমরা এই WhatsApp-এই কথা বলব। কিছু যোগ করার থাকলে এখানেই লিখুন।`
                : `Hi ${first}, your ticket ${ticket.ticketId} has been created.\nSee its current status: ${link}\n\nWe'll keep talking about it right here on WhatsApp. Just reply here if you have anything to add.`;
            messageId = await whatsappService.sendTextMessage(phone, body);
        } else {
            const template = bengali ? envConfig.wa_template_ticket_bn : envConfig.wa_template_ticket_en;
            body = bengali
                ? `${first}, আপনার টিকেট ${ticket.ticketId} খোলা হয়েছে। (টিকেট দেখুন: ${link})`
                : `Hi ${first}, your ticket ${ticket.ticketId} has been created. (Track ticket: ${link})`;
            messageId = await whatsappService.sendTemplateMessage(phone, template, bengali ? 'bn' : 'en', [first, ticket.ticketId], token);
        }

        // Show it in the WhatsApp inbox so agents see exactly what the customer was told.
        await WhatsAppMessageModel.create({
            conversationId: conversation._id,
            direction: WhatsAppMessageDirection.OUTBOUND,
            sender: WhatsAppMessageSender.AI,
            type: WhatsAppMessageType.TEXT,
            body,
            whatsappMsgId: messageId || `ticket:${ticket._id}`,
            status: WhatsAppMessageStatus.SENT,
        });
        await WhatsAppConversationModel.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: new Date() } });
        await TicketModel.updateOne({ _id: ticket._id }, { $set: { whatsappNotifiedAt: new Date() } });
        logger.info(`[ticket] WhatsApp notice sent for ${ticket.ticketId}`);
    } catch (err: any) {
        // Most common before the templates are approved: "template does not exist". The ticket itself is fine.
        logger.warn(`[ticket] could not send the WhatsApp notice: ${err.message}`);
    }
}

export default { notifyTicketCreated, ensurePublicToken, whatsappNumberOf, trackingUrl };
