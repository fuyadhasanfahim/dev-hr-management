import { Schema, model, Document, Types } from 'mongoose';
import type { ReceiptPaymentType } from './receipt.model.js';

export type PaymentEntryStatus = 'recorded' | 'void';

export interface IReceiptPayment extends Document {
    receiptId: Types.ObjectId;

    paymentType: ReceiptPaymentType;
    milestoneLabel?: string;
    amount: number;
    paymentDate: Date;
    method?: string;
    note?: string;

    status: PaymentEntryStatus;
    voidReason?: string;

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const receiptPaymentSchema = new Schema<IReceiptPayment>(
    {
        receiptId: {
            type: Schema.Types.ObjectId,
            ref: 'Receipt',
            required: true,
            index: true,
        },

        paymentType: {
            type: String,
            enum: ['full', 'partial', 'milestone'],
            required: true,
        },
        milestoneLabel: { type: String },
        amount: { type: Number, required: true, min: 0 },
        paymentDate: { type: Date, required: true },
        method: { type: String },
        note: { type: String },

        status: {
            type: String,
            enum: ['recorded', 'void'],
            default: 'recorded',
            index: true,
        },
        voidReason: { type: String },

        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);

receiptPaymentSchema.index({ receiptId: 1, status: 1 });
receiptPaymentSchema.index({ receiptId: 1, paymentDate: -1 });

const ReceiptPaymentModel = model<IReceiptPayment>('ReceiptPayment', receiptPaymentSchema);
export default ReceiptPaymentModel;
