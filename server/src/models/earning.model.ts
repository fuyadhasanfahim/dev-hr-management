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
        receiptId: {
            type: Schema.Types.ObjectId,
            ref: 'Receipt',
            required: true,
        },
        quotationGroupId: {
            type: String,
            required: true,
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
                    required: true,
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
EarningSchema.index({ receiptId: 1 }, { unique: true });

EarningSchema.index({ status: 1, year: -1, month: -1 });
EarningSchema.index({ clientId: 1, year: -1, month: -1 });

const EarningModel = model<IEarning>('Earning', EarningSchema);
export default EarningModel;
