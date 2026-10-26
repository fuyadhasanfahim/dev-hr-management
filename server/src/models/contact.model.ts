import { Schema, model, Document, Types } from 'mongoose';

// One person, however they reach us: a WhatsApp number, a website guest (verified email), a client account.
// Tickets, WhatsApp chats and live chats point at a Contact, so everything one person ever said is in one place.
// Phones are stored normalised (digits only, Bangladesh numbers as 8801XXXXXXXXX), emails lower-cased.
export interface IContact extends Document {
    name?: string;
    phones: string[];
    emails: string[];
    whatsappPhone?: string; // The number we know is on WhatsApp, if any.
    guestIds: Types.ObjectId[]; // Ref: Guest
    clientId?: Types.ObjectId; // Ref: Client — set when this person is one of our clients.
    leadId?: Types.ObjectId; // Ref: Lead
    lastActivityAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
    {
        name: { type: String, trim: true },
        phones: { type: [String], default: [], index: true },
        emails: { type: [String], default: [], index: true },
        whatsappPhone: { type: String },
        guestIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Guest' }], default: [], index: true },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client', index: true },
        leadId: { type: Schema.Types.ObjectId, ref: 'Lead', index: true },
        lastActivityAt: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true },
);

contactSchema.index({ name: 'text', emails: 'text', phones: 'text' });

const ContactModel = model<IContact>('Contact', contactSchema);
export default ContactModel;
