import { Schema, model, Document, Types } from 'mongoose';
import type { QuotationCategory } from '../types/quotation.type.js';

export type ReceiptPaymentType = 'full' | 'partial' | 'milestone';
export type ReceiptStatus = 'issued' | 'void';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'void';

export interface IReceipt extends Document {
    receiptNumber: string;

    // ── Quotation linkage ─────────────────────────────────────────────────────
    quotationId: Types.ObjectId;
    quotationGroupId: string;
    quotationNumber: string;

    // ── Immutable snapshots at receipt creation ───────────────────────────────
    clientId: Types.ObjectId;
    clientName: string;
    projectTitle: string;
    category: QuotationCategory;
    currency: string;

    // ── Payment ledger (computed from paymentHistory) ─────────────────────────
    totalPaid: number;
    paymentStatus: PaymentStatus;
    paymentHistory: Types.ObjectId[];  // → ref ReceiptPayment

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    status: ReceiptStatus;
    voidReason?: string;

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const receiptSchema = new Schema<IReceipt>(
    {
        receiptNumber: { type: String, required: true, unique: true, index: true },

        quotationId: { type: Schema.Types.ObjectId, ref: 'Quotation', required: true },
        quotationGroupId: { type: String, required: true, index: true },
        quotationNumber: { type: String, required: true },

        clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
        clientName: { type: String, required: true },
        projectTitle: { type: String, required: true },
        category: {
            type: String,
            enum: ['web-development', 'photo-editing', 'marketing', 'video-editing'],
            required: true,
            default: 'web-development',
        },
        currency: { type: String, default: '৳' },

        // Ledger totals (updated atomically on each addPayment / voidPayment)
        totalPaid: { type: Number, default: 0, min: 0 },
        paymentStatus: {
            type: String,
            enum: ['pending', 'partial', 'paid', 'void'],
            default: 'pending',
            index: true,
        },
        paymentHistory: [{ type: Schema.Types.ObjectId, ref: 'ReceiptPayment' }],

        status: {
            type: String,
            enum: ['issued', 'void'],
            default: 'issued',
            index: true,
        },
        voidReason: { type: String },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);

receiptSchema.index({ quotationGroupId: 1, status: 1 });
receiptSchema.index({ clientId: 1, createdAt: -1 });

const ReceiptModel = model<IReceipt>('Receipt', receiptSchema);
export default ReceiptModel;
