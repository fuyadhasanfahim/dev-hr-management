/**
 * One-time backfill: give every existing ticket, WhatsApp chat, live chat and verified website guest a Contact,
 * so Tickets can show one person across WhatsApp and the website. Additive: it only sets `contactId` / `channel`
 * on documents that lack them and creates Contact documents. Safe to re-run.
 *
 *   npx tsx src/scripts/backfill-contacts.ts            # dry run (default): prints what it would do
 *   npx tsx src/scripts/backfill-contacts.ts --commit   # write changes
 */
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import ContactModel from '../models/contact.model.js';
import GuestModel from '../models/guest.model.js';
import TicketModel, { channelOfSource } from '../models/ticket.model.js';
import ChatSessionModel from '../models/chat-session.model.js';
import WhatsAppConversationModel from '../models/whatsapp-conversation.model.js';
import { identityOf, resolveContact, type ContactIdentity } from '../services/contact.service.js';

const COMMIT = process.argv.includes('--commit');

async function main() {
    await mongoose.connect(envConfig.mongo_uri, { dbName: envConfig.db_name });
    console.log(COMMIT ? 'COMMIT mode: writing changes' : 'DRY RUN: nothing is written (pass --commit to write)');
    const before = await ContactModel.countDocuments();

    const stats = { guests: 0, whatsapp: 0, tickets: 0, ticketsChannel: 0, chats: 0, skipped: 0 };
    const link = async (identity: ContactIdentity) => (COMMIT ? (await resolveContact(identity))?._id : undefined);

    // Verified guests first, so their email + phone is known before their tickets and chats are matched.
    for await (const guest of GuestModel.find({ emailVerified: true }).lean()) {
        stats.guests++;
        await link(await identityOf({ guestId: guest._id }));
    }

    for await (const c of WhatsAppConversationModel.find({ contactId: { $exists: false } })) {
        stats.whatsapp++;
        const id = await link({ name: c.customerName, whatsappPhone: c.customerPhone });
        if (id) await WhatsAppConversationModel.updateOne({ _id: c._id }, { $set: { contactId: id } });
    }

    for await (const t of TicketModel.find({ $or: [{ contactId: { $exists: false } }, { channel: { $exists: false } }] })) {
        const set: Record<string, unknown> = {};
        if (!t.channel) {
            set.channel = channelOfSource(t.source);
            stats.ticketsChannel++;
        }
        if (!t.contactId) {
            stats.tickets++;
            const id = await link(await identityOf(t));
            if (id) set.contactId = id;
            else if (COMMIT) stats.skipped++;
        }
        if (COMMIT && Object.keys(set).length) await TicketModel.updateOne({ _id: t._id }, { $set: set });
    }

    for await (const s of ChatSessionModel.find({ contactId: { $exists: false } })) {
        stats.chats++;
        const id = await link(await identityOf(s));
        if (id) await ChatSessionModel.updateOne({ _id: s._id }, { $set: { contactId: id } });
    }

    const after = await ContactModel.countDocuments();
    console.log('Scanned:', stats);
    console.log(`Contacts: ${before} -> ${COMMIT ? after : `${before} (would grow; run with --commit)`}`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
