import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import ContactModel from '../models/contact.model.js';
import TicketModel from '../models/ticket.model.js';
import ChatSessionModel from '../models/chat-session.model.js';
import WhatsAppConversationModel from '../models/whatsapp-conversation.model.js';
import ClientModel from '../models/client.model.js';
import LeadModel from '../models/lead.model.js';
import { normalizeEmail, normalizePhone } from '../services/contact.service.js';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Staff: search contacts by name, email or phone. */
async function searchContacts(req: Request, res: Response) {
    try {
        const q = String(req.query.q ?? '').trim();
        const limit = Math.min(Number(req.query.limit) || 20, 50);
        const or: Record<string, unknown>[] = [];
        if (q) {
            or.push({ name: new RegExp(escapeRegex(q), 'i') });
            const email = normalizeEmail(q);
            if (email) or.push({ emails: email });
            else or.push({ emails: new RegExp(escapeRegex(q.toLowerCase())) });
            const phone = normalizePhone(q);
            if (phone) or.push({ phones: phone });
        }
        const contacts = await ContactModel.find(or.length ? { $or: or } : {})
            .sort({ lastActivityAt: -1 })
            .limit(limit)
            .lean();
        return res.status(200).json({ success: true, data: contacts });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

/** Staff: one person with everything we have on them: tickets, WhatsApp chats, live chats, client and lead. */
async function getContact(req: Request, res: Response) {
    try {
        const id = String(req.params.id ?? '');
        if (!Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid contact id' });
        const contact = await ContactModel.findById(id).lean();
        if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });

        const [tickets, whatsappChats, liveChats, client, lead] = await Promise.all([
            TicketModel.find({ contactId: contact._id })
                .select('ticketId subject status priority category source channel createdAt updatedAt')
                .sort({ updatedAt: -1 })
                .limit(50)
                .lean(),
            WhatsAppConversationModel.find({ contactId: contact._id })
                .select('customerPhone status lastMessageAt linkedTicketId')
                .sort({ lastMessageAt: -1 })
                .limit(20)
                .lean(),
            ChatSessionModel.find({ contactId: contact._id })
                .select('sessionId status createdAt linkedTicketId')
                .sort({ createdAt: -1 })
                .limit(20)
                .lean(),
            contact.clientId ? ClientModel.findById(contact.clientId).select('name emails phone status').lean() : null,
            contact.leadId ? LeadModel.findById(contact.leadId).select('name phone email status').lean() : null,
        ]);

        return res.status(200).json({ success: true, data: { contact, tickets, whatsappChats, liveChats, client, lead } });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

export default { searchContacts, getContact };
