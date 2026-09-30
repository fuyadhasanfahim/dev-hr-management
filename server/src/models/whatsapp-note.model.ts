import { Schema, model, Document } from 'mongoose';

// Internal agent notes about a WhatsApp customer. Keyed by phone, not
// conversation, so they carry over when a resolved chat starts again.
export interface IWhatsAppNote extends Document {
    customerPhone: string;
    body: string;
    author: { id: string; name: string };
    createdAt: Date;
    updatedAt: Date;
}

const whatsAppNoteSchema = new Schema<IWhatsAppNote>(
    {
        customerPhone: { type: String, required: true, index: true },
        body: { type: String, required: true, trim: true, maxlength: 4000 },
        author: {
            type: new Schema({ id: { type: String, required: true }, name: String }, { _id: false }),
            required: true,
        },
    },
    { timestamps: true },
);

const WhatsAppNoteModel = model<IWhatsAppNote>('WhatsAppNote', whatsAppNoteSchema);
export default WhatsAppNoteModel;
