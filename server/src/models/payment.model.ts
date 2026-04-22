import { Schema, model, Document, Types } from 'mongoose';

export enum PaymentMethod {
    STRIPE = 'stripe',
    PAYPAL = 'paypal',
    MANUAL = 'manual',
    BANK_TRANSFER = 'bank_transfer'
}

export enum PaymentStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export interface IPayment extends Document {
    invoiceId: Types.ObjectId;
    amount: number;
    method: PaymentMethod;
    status: PaymentStatus;
    transactionId?: string;
    notes?: string;
    paidAt: Date;
    createdBy?: Types.ObjectId;
}

const paymentSchema = new Schema<IPayment>(
    {
        invoiceId: {
            type: Schema.Types.ObjectId,
            ref: 'Invoice',
            required: true,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },
        method: {
            type: String,
            enum: Object.values(PaymentMethod),
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(PaymentStatus),
            default: PaymentStatus.PENDING,
            index: true,
        },
        transactionId: {
            type: String,
            sparse: true,
            unique: true,
        },
        notes: {
            type: String,
        },
        paidAt: {
            type: Date,
            default: Date.now,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true },
);

const PaymentModel = model<IPayment>('Payment', paymentSchema);
export default PaymentModel;
