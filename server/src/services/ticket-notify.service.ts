import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import envConfig from '../config/env.config.js';
import TicketModel from '../models/ticket.model.js';
import WhatsAppMessageModel, { WhatsAppMessageDirection } from '../models/whatsapp-message.model.js';
import { normalizePhone } from './contact.service.js';
import emailService from './email.service.js';
import { logger } from '../lib/logger.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Tracking links for tickets. Tickets live on the website chat only: nothing is sent to WhatsApp about them.

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

/**
 * Tickets that predate tracking links get a token the first time one is needed. Atomic: two callers at once end up
 * with the same token, never two different ones.
 */
export async function ensurePublicToken(ticketId: Types.ObjectId | string): Promise<string> {
    const existing: any = await TicketModel.findById(ticketId).select('publicToken').lean();
    if (existing?.publicToken) return existing.publicToken;
    const token = randomBytes(18).toString('base64url');
    await TicketModel.updateOne({ _id: ticketId, publicToken: { $exists: false } }, { $set: { publicToken: token } });
    const after: any = await TicketModel.findById(ticketId).select('publicToken').lean();
    return after?.publicToken ?? token;
}

/** Where to email the customer: what they gave on the ticket, else the guest or client record behind it. */
async function emailOf(ticketId: Types.ObjectId | string): Promise<{ ticket: any; to: string } | null> {
    const ticket: any = await TicketModel.findById(ticketId)
        .select('ticketId subject visitorName visitorEmail guestId clientId')
        .populate('guestId', 'email name')
        .populate('clientId', 'email emails name')
        .lean();
    if (!ticket) return null;
    const to = String(ticket.visitorEmail || ticket.guestId?.email || ticket.clientId?.emails?.[0] || ticket.clientId?.email || '').trim();
    if (!to) return null;
    return { ticket: { ...ticket, visitorName: ticket.visitorName || ticket.guestId?.name || ticket.clientId?.name || '' }, to };
}

/** Emails the customer their ticket number and private link. Best effort: the ticket already exists. */
export async function emailTicketCreated(ticketId: Types.ObjectId | string): Promise<void> {
    try {
        const found = await emailOf(ticketId);
        if (!found) return;
        const token = await ensurePublicToken(found.ticket._id);
        await emailService.sendTicketEmail({
            to: found.to,
            name: found.ticket.visitorName,
            ticketId: found.ticket.ticketId,
            subject: found.ticket.subject,
            trackUrl: trackingUrl(token),
            kind: 'created',
        });
    } catch (err: any) {
        logger.warn(`[ticket] could not email the ticket link: ${err.message}`);
    }
}

/** Emails the customer that the team replied, with the same private link. False when there is nobody to email. */
export async function emailTicketReply(ticketId: Types.ObjectId | string, text: string): Promise<boolean> {
    try {
        const found = await emailOf(ticketId);
        if (!found) return false;
        const token = await ensurePublicToken(found.ticket._id);
        await emailService.sendTicketEmail({
            to: found.to,
            name: found.ticket.visitorName,
            ticketId: found.ticket.ticketId,
            subject: found.ticket.subject,
            trackUrl: trackingUrl(token),
            kind: 'reply',
            preview: text.trim().slice(0, 300),
        });
        return true;
    } catch (err: any) {
        logger.warn(`[ticket] could not email the reply: ${err.message}`);
        return false;
    }
}

export default { emailTicketCreated, emailTicketReply, ensurePublicToken, whatsappNumberOf, trackingUrl };
