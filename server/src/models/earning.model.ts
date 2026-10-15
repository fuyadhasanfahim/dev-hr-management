import { model, Schema } from 'mongoose';
import type { IEarning } from '../types/earning.type.js';

const EarningSchema = new Schema<IEarning>(
    {
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        // Project-order earnings mirror a receipt 1:1 ...
        receiptId: {
            type: Schema.Types.ObjectId,
            ref: 'Receipt',
        },
        quotationGroupId: {
            type: String,
        },
        // ... photo-editing earnings mirror a paid photo invoice instead (quotationNumber holds its invoice number).
        photoInvoiceId: {
            type: Schema.Types.ObjectId,
            ref: 'PhotoInvoice',
        },
        quotationNumber: {
            type: String,
            required: true,
        },
        orderTitle: {
            type: String,
            required: true,
        },
        currency: {
            type: String,
            required: true,
            default: '৳',
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        paidAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        amountInBDT: {
            type: Number,
            required: true,
            min: 0,
        },

        status: {
            type: String,
            enum: ['partial', 'paid', 'void'],
            required: true,
            index: true,
        },
        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            required: true,
        },

        payments: [
            {
                receiptPaymentId: {
                    type: Schema.Types.ObjectId,
                    ref: 'ReceiptPayment',
                },
                amount: { type: Number, required: true },
                paymentDate: { type: Date, required: true },
                paymentType: { type: String, required: true },
                milestoneLabel: { type: String },
                method: { type: String },
                note: { type: String },
                _id: false,
            },
        ],

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

// One Earning per Receipt — it only exists once the receipt has a recorded payment.
// Partial, so photo-invoice earnings (which have no receipt) never collide on a missing receiptId.
EarningSchema.index({ receiptId: 1 }, { unique: true, partialFilterExpression: { receiptId: { $exists: true } } });
// One Earning per paid photo invoice.
EarningSchema.index({ photoInvoiceId: 1 }, { unique: true, partialFilterExpression: { photoInvoiceId: { $exists: true } } });

EarningSchema.index({ status: 1, year: -1, month: -1 });
EarningSchema.index({ clientId: 1, year: -1, month: -1 });

const EarningModel = model<IEarning>('Earning', EarningSchema);
export default EarningModel;
