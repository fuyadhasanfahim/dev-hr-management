import { Types } from 'mongoose';
import ContactModel, { type IContact } from '../models/contact.model.js';
import ClientModel from '../models/client.model.js';
import LeadModel from '../models/lead.model.js';
import GuestModel from '../models/guest.model.js';
import TicketModel from '../models/ticket.model.js';
import ChatSessionModel from '../models/chat-session.model.js';
import WhatsAppConversationModel from '../models/whatsapp-conversation.model.js';
import { logger } from '../lib/logger.js';

// Finds or creates the Contact behind a ticket, a WhatsApp chat or a live chat, matching on any known phone or
// email. Best effort: callers wrap it so a failure here never blocks a message or a ticket.

/** Digits only; Bangladesh numbers become 8801XXXXXXXXX (01XXXXXXXXX, 1XXXXXXXXX, +880…, 00880… all match). '' if unusable. */
export function normalizePhone(raw?: string | null): string {
    let d = String(raw ?? '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('01')) d = `880${d.slice(1)}`;
    else if (d.length === 10 && d.startsWith('1')) d = `880${d}`;
    return d.length >= 7 && d.length <= 15 ? d : '';
}

export function normalizeEmail(raw?: string | null): string {
    const e = String(raw ?? '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : '';
}

export interface ContactIdentity {
    name?: string;
    emails?: (string | undefined | null)[];
    phones?: (string | undefined | null)[];
    whatsappPhone?: string | null; // a number known to be on WhatsApp
    guestId?: Types.ObjectId | string | null;
    clientId?: Types.ObjectId | string | null;
}

const uniq = <T>(list: T[]) => [...new Set(list)];

/** Merges duplicates into the oldest contact and re-points everything that referenced them. */
async function merge(keep: IContact, others: IContact[]): Promise<void> {
    for (const other of others) {
        keep.phones = uniq([...keep.phones, ...other.phones]);
        keep.emails = uniq([...keep.emails, ...other.emails]);
        keep.guestIds = uniq([...keep.guestIds, ...other.guestIds].map(String)).map((id) => new Types.ObjectId(id));
        keep.name ||= other.name;
        keep.whatsappPhone ||= other.whatsappPhone;
        keep.clientId ||= other.clientId;
        keep.leadId ||= other.leadId;
        const moved = { contactId: other._id };
        await Promise.all([
            TicketModel.updateMany(moved, { $set: { contactId: keep._id } }),
            ChatSessionModel.updateMany(moved, { $set: { contactId: keep._id } }),
            WhatsAppConversationModel.updateMany(moved, { $set: { contactId: keep._id } }),
        ]);
        await ContactModel.deleteOne({ _id: other._id });
    }
}

/** Attach the matching client and lead (by email or phone) when the contact has none yet. */
async function linkAccounts(contact: IContact): Promise<void> {
    if (!contact.clientId && (contact.emails.length || contact.phones.length)) {
        const clients = await ClientModel.find({}, { emails: 1, phone: 1 }).limit(5000).lean();
        const hit = clients.find(
            (c: any) =>
                (c.emails ?? []).some((e: string) => contact.emails.includes(normalizeEmail(e))) ||
                (c.phone && contact.phones.includes(normalizePhone(c.phone))),
        );
        if (hit) contact.clientId = hit._id as Types.ObjectId;
    }
    if (!contact.leadId && (contact.emails.length || contact.phones.length)) {
        const leads = await LeadModel.find({}, { email: 1, phone: 1 }).sort({ createdAt: -1 }).limit(5000).lean();
        const hit = leads.find(
            (l: any) =>
                (l.email && contact.emails.includes(normalizeEmail(l.email))) ||
                (l.phone && contact.phones.includes(normalizePhone(l.phone))),
        );
        if (hit) contact.leadId = hit._id as Types.ObjectId;
    }
}

export async function resolveContact(identity: ContactIdentity): Promise<IContact | null> {
    const emails = uniq((identity.emails ?? []).map(normalizeEmail).filter(Boolean));
    const whatsapp = normalizePhone(identity.whatsappPhone);
    const phones = uniq([...(identity.phones ?? []).map(normalizePhone), whatsapp].filter(Boolean));
    const guestId = identity.guestId ? new Types.ObjectId(String(identity.guestId)) : null;
    const clientId = identity.clientId ? new Types.ObjectId(String(identity.clientId)) : null;
    if (!emails.length && !phones.length && !guestId && !clientId) return null;

    const or: Record<string, unknown>[] = [];
    if (emails.length) or.push({ emails: { $in: emails } });
    if (phones.length) or.push({ phones: { $in: phones } });
    if (guestId) or.push({ guestIds: guestId });
    if (clientId) or.push({ clientId });

    const found = await ContactModel.find({ $or: or }).sort({ createdAt: 1 });
    let contact: IContact;
    if (found.length === 0) {
        contact = new ContactModel({ name: identity.name?.trim() || undefined });
    } else {
        contact = found[0]!;
        if (found.length > 1) await merge(contact, found.slice(1));
    }

    contact.emails = uniq([...contact.emails, ...emails]);
    contact.phones = uniq([...contact.phones, ...phones]);
    if (whatsapp) contact.whatsappPhone = whatsapp;
    if (guestId && !contact.guestIds.some((g) => g.equals(guestId))) contact.guestIds.push(guestId);
    if (clientId) contact.clientId = clientId;
    if (!contact.name && identity.name?.trim()) contact.name = identity.name.trim();
    contact.lastActivityAt = new Date();

    try {
        await linkAccounts(contact);
    } catch (err: any) {
        logger.warn(`[contact] could not link client/lead: ${err.message}`);
    }
    await contact.save();
    return contact;
}

/** Who a ticket / chat session belongs to, read from its guest or client record plus any visitor snapshot. */
export async function identityOf(doc: {
    guestId?: Types.ObjectId | null;
    clientId?: Types.ObjectId | null;
    visitorName?: string | null;
    visitorEmail?: string | null;
    visitorPhone?: string | null;
    visitorIsWhatsapp?: boolean | null;
    whatsappPhone?: string | null;
}): Promise<ContactIdentity> {
    const identity: ContactIdentity = {
        name: doc.visitorName ?? undefined,
        emails: [doc.visitorEmail],
        phones: [doc.visitorPhone],
        whatsappPhone: doc.whatsappPhone ?? (doc.visitorIsWhatsapp ? doc.visitorPhone : undefined),
        guestId: doc.guestId,
        clientId: doc.clientId,
    };
    if (doc.guestId) {
        const guest: any = await GuestModel.findById(doc.guestId).select('name email phone isWhatsapp').lean();
        if (guest) {
            identity.name ||= guest.name;
            identity.emails = [...(identity.emails ?? []), guest.email];
            identity.phones = [...(identity.phones ?? []), guest.phone];
            if (guest.isWhatsapp && guest.phone) identity.whatsappPhone ||= guest.phone;
        }
    }
    if (doc.clientId) {
        const client: any = await ClientModel.findById(doc.clientId).select('name emails phone').lean();
        if (client) {
            identity.name ||= client.name;
            identity.emails = [...(identity.emails ?? []), ...(client.emails ?? [])];
            identity.phones = [...(identity.phones ?? []), client.phone];
        }
    }
    return identity;
}

/** For model hooks: never throws, returns the contact id or undefined. */
export async function contactIdFor(identity: ContactIdentity | Promise<ContactIdentity>): Promise<Types.ObjectId | undefined> {
    try {
        return (await resolveContact(await identity))?._id as Types.ObjectId | undefined;
    } catch (err: any) {
        logger.warn(`[contact] could not resolve contact: ${err.message}`);
        return undefined;
    }
}

export default { normalizePhone, normalizeEmail, resolveContact, identityOf, contactIdFor };
