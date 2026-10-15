import { model, Schema } from 'mongoose';

/** Sequence for photo-editing invoice numbers — separate from every other counter. */
const photoInvoiceCounterSchema = new Schema<{ _id: string; seq: number }>({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

export const PhotoInvoiceCounter = model('PhotoInvoiceCounter', photoInvoiceCounterSchema);
