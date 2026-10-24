import { Schema, model, Document } from 'mongoose';

// What the AI knows about one WhatsApp customer, kept per phone number (not per conversation) so it survives a
// resolved chat starting again — a customer who said "I want a Shopify store" last month isn't asked again.
// The AI rewrites it after every reply; staff can read and edit it in the contact-info panel.
export interface IWhatsAppCustomerMemory extends Document {
    customerPhone: string;
    text: string;
    updatedBy: string; // 'AI' or the staff member who last edited it
    createdAt: Date;
    updatedAt: Date;
}

const schema = new Schema<IWhatsAppCustomerMemory>(
    {
        customerPhone: { type: String, required: true, unique: true, index: true },
        text: { type: String, default: '', maxlength: 2000 },
        updatedBy: { type: String, default: 'AI' },
    },
    { timestamps: true },
);

const WhatsAppCustomerMemoryModel = model<IWhatsAppCustomerMemory>('WhatsAppCustomerMemory', schema);
export default WhatsAppCustomerMemoryModel;
