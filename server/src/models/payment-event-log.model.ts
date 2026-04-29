import { Schema, model, Document } from 'mongoose';

export type PaymentEventStatus = 'pending' | 'processed' | 'duplicate' | 'failed';
export type PaymentProvider = 'stripe' | 'paypal';
export type QuotationPaymentPhase = 'upfront' | 'delivery' | 'final';

export interface IPaymentEventLog extends Document {
    /**
     * Primary dedup key — format: `${provider}:${providerId}`
     * Unique index prevents duplicate processing even under concurrent webhook delivery.
     */
    idempotencyKey: string;

    provider: PaymentProvider;

    /** Stripe event ID (evt_xxx) or PayPal webhook event ID */
    providerId: string;

    eventType: string;   // e.g. 'payment_intent.succeeded', 'PAYMENT.CAPTURE.COMPLETED'

    quotationGroupId?: string;
    phase?: QuotationPaymentPhase;
    correlationId?: string;

    amountReceived?: number;   // in cents
    currency?: string;

    /** Full raw webhook payload — kept for audit and replay */
    rawPayload: Record<string, unknown>;

    status: PaymentEventStatus;
    failureReason?: string;

    processedAt?: Date;
    createdAt: Date;
}

const paymentEventLogSchema = new Schema<IPaymentEventLog>(
    {
        idempotencyKey: {
            type: String,
            required: true,
            unique: true,   // ← PRIMARY DEDUP GATE
            index: true,
        },
        provider: {
            type: String,
            enum: ['stripe', 'paypal'],
            required: true,
        },
        providerId: {
            type: String,
            required: true,
            index: true,
        },
        eventType: {
            type: String,
            required: true,
        },
        quotationGroupId: {
            type: String,
            index: true,
            sparse: true,
        },
        correlationId: {
            type: String,
            index: true,
            sparse: true,
        },
        phase: {
            type: String,
            enum: ['upfront', 'delivery', 'final'],
        },
        amountReceived: { type: Number },
        currency: { type: String, uppercase: true },
        rawPayload: {
            type: Schema.Types.Mixed,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'processed', 'duplicate', 'failed'],
            default: 'pending',
            index: true,
        },
        failureReason: { type: String },
        processedAt: { type: Date },
    },
    {
        timestamps: true,
        // Never allow updates to this collection — it is append-only
        // Enforced at application layer; schema-level write concern is advisory
    },
);

// Compound index for provider-level dedup lookups
paymentEventLogSchema.index({ provider: 1, providerId: 1 }, { unique: true });

const PaymentEventLogModel = model<IPaymentEventLog>('PaymentEventLog', paymentEventLogSchema);
export default PaymentEventLogModel;
