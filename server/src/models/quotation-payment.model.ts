import { Schema, model, Document, Types } from 'mongoose';

export type PaymentPhaseStatus = 'pending' | 'processing' | 'paid' | 'failed';
export type QuotationPaymentPhase = 'upfront' | 'delivery' | 'final';

export interface IPaymentPhase {
    status: PaymentPhaseStatus;
    percentage: number;    // 50 | 30 | 20
    amountDue: number;     // in smallest currency unit (cents)
    amountPaid: number;
    paymentIntentId?: string;  // Stripe PaymentIntent ID or PayPal Order ID
    idempotencyKey?: string;   // stored for reference
    paidAt?: Date;
}

export interface IQuotationPayment extends Document {
    quotationGroupId: string;   // shared across all versions
    orderId?: Types.ObjectId;   // populated after upfront paid + order created
    clientId: Types.ObjectId;
    currency: string;
    totalAmount: number;        // grand total in cents
    phases: {
        upfront: IPaymentPhase;
        delivery: IPaymentPhase;
        final: IPaymentPhase;
    };
    createdAt: Date;
    updatedAt: Date;
}

const paymentPhaseSchema = new Schema<IPaymentPhase>(
    {
        status: {
            type: String,
            enum: ['pending', 'processing', 'paid', 'failed'],
            default: 'pending',
        },
        percentage: { type: Number, required: true },
        amountDue: { type: Number, required: true, min: 0 },
        amountPaid: { type: Number, default: 0, min: 0 },
        paymentIntentId: { type: String, sparse: true },
        idempotencyKey: { type: String },
        paidAt: { type: Date },
    },
    { _id: false },
);

const quotationPaymentSchema = new Schema<IQuotationPayment>(
    {
        quotationGroupId: {
            type: String,
            required: true,
            unique: true,   // ONE tracker per quotation group — enforced at DB level
            index: true,
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            sparse: true,
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        currency: {
            type: String,
            required: true,
            uppercase: true,
            default: 'USD',
        },
        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        phases: {
            upfront: {
                type: paymentPhaseSchema,
                default: () => ({ status: 'pending', percentage: 50, amountDue: 0, amountPaid: 0 }),
            },
            delivery: {
                type: paymentPhaseSchema,
                default: () => ({ status: 'pending', percentage: 30, amountDue: 0, amountPaid: 0 }),
            },
            final: {
                type: paymentPhaseSchema,
                default: () => ({ status: 'pending', percentage: 20, amountDue: 0, amountPaid: 0 }),
            },
        },
    },
    { timestamps: true },
);

// Guard: delivery phase cannot be initiated before upfront is paid
quotationPaymentSchema.pre('save', function (next) {
    if (
        this.phases.delivery.status === 'processing' ||
        this.phases.delivery.status === 'paid'
    ) {
        if (this.phases.upfront.status !== 'paid') {
            return next(new Error('Delivery phase cannot be initiated before upfront payment is completed'));
        }
    }
    if (
        this.phases.final.status === 'processing' ||
        this.phases.final.status === 'paid'
    ) {
        if (this.phases.delivery.status !== 'paid') {
            return next(new Error('Final phase cannot be initiated before delivery payment is completed'));
        }
    }
    next();
});

const QuotationPaymentModel = model<IQuotationPayment>('QuotationPayment', quotationPaymentSchema);
export default QuotationPaymentModel;
