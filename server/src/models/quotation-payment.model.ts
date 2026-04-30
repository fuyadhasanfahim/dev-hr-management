import { Schema, model, Document, Types } from 'mongoose';

export type PaymentPhaseStatus = 'pending' | 'processing' | 'partial' | 'paid' | 'failed';
export type QuotationPaymentPhase = 'upfront' | 'delivery' | 'final';

export interface IPaymentPhase {
    status: PaymentPhaseStatus;
    percentage: number;    // 50 | 30 | 20
    amountDue: number;     // in smallest currency unit (cents)
    amountPaid: number;    // cumulative; incremented on each partial/full receipt
    paymentIntentId?: string;  // most recent Stripe PaymentIntent ID or PayPal Order ID
    /**
     * All payment-intent IDs already applied to this phase.
     * Used to detect and reject duplicate webhook deliveries.
     */
    paidIntentIds: string[];
    idempotencyKey?: string;   // stored for reference
    paidAt?: Date;
}

export interface IQuotationPayment extends Document {
    quotationGroupId: string;   // shared across all versions
    /** The specific quotation version this payable is for (latest-only invariant). */
    quotationId: Types.ObjectId;
    quotationVersion: number;
    /**
     * Exactly one active payable per quotationGroupId.
     * Older payables are retained for audit but marked inactive.
     */
    isActive: boolean;
    supersededAt?: Date;
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
            enum: ['pending', 'processing', 'partial', 'paid', 'failed'],
            default: 'pending',
        },
        percentage: { type: Number, required: true },
        amountDue: { type: Number, required: true, min: 0 },
        amountPaid: { type: Number, default: 0, min: 0 },
        paymentIntentId: { type: String, sparse: true },
        paidIntentIds: { type: [String], default: [] },
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
            index: true,
        },
        quotationId: {
            type: Schema.Types.ObjectId,
            ref: 'Quotation',
            required: true,
        },
        quotationVersion: {
            type: Number,
            required: true,
            min: 1,
            index: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        supersededAt: { type: Date },
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

/**
 * Invariant: one "active payable" per quotationGroupId.
 * Enforced via a partial unique index (MongoDB).
 */
quotationPaymentSchema.index(
    { quotationGroupId: 1, isActive: 1 },
    { unique: true, partialFilterExpression: { isActive: true } },
);

/**
 * Prevent creating multiple payables for the same exact quotation version.
 * (Useful under retries / concurrency.)
 */
quotationPaymentSchema.index({ quotationId: 1 }, { unique: true });

// Guard: phases must be fully paid (not just partial) before the next phase can be initiated
quotationPaymentSchema.pre('save', function (this: IQuotationPayment) {
    const doc = this;

    if (
        doc.phases.delivery.status === 'processing' ||
        doc.phases.delivery.status === 'partial' ||
        doc.phases.delivery.status === 'paid'
    ) {
        if (doc.phases.upfront.status !== 'paid') {
            throw new Error('Delivery phase cannot be initiated before upfront payment is completed');
        }
    }
    if (
        doc.phases.final.status === 'processing' ||
        doc.phases.final.status === 'partial' ||
        doc.phases.final.status === 'paid'
    ) {
        if (doc.phases.delivery.status !== 'paid') {
            throw new Error('Final phase cannot be initiated before delivery payment is completed');
        }
    }
});

const QuotationPaymentModel = model<IQuotationPayment>('QuotationPayment', quotationPaymentSchema);
export default QuotationPaymentModel;
