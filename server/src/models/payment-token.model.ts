import { Schema, model, Document, Types } from 'mongoose';

/**
 * One row per issued client-payment link. `jti` is the unique id embedded in
 * the signed JWT handed to the client (in the invoice's Pay Now URL) — the
 * JWT's signature proves it came from us, and this row is the DB-side source
 * of truth for whether that specific link is still usable:
 *
 *   active    → link is live, has not been used
 *   consumed  → a payment was successfully captured through it; never usable again
 *   void      → superseded by a newer token for the same order (rotation), or
 *               manually invalidated
 *
 * `amountDue`/`currency` are a display-time snapshot only — the actual charge
 * amount is always recomputed live from the Order/Receipt/Quotation at
 * payment time (see payment.service.ts), never trusted from this row or from
 * the client.
 */
export type PaymentTokenStatus = 'active' | 'consumed' | 'void';

export interface IPaymentToken extends Document {
    jti: string;
    /** The signed JWT itself — returned verbatim on reuse so the Pay Now link stays stable. */
    token: string;

    orderId: Types.ObjectId;
    receiptId: Types.ObjectId;
    quotationGroupId: string;
    clientId: Types.ObjectId;

    amountDue: number;
    currency: string;

    status: PaymentTokenStatus;
    expiresAt: Date;

    consumedAt?: Date;
    consumedVia?: 'stripe' | 'paypal';
    /** Stripe PaymentIntent id / PayPal order id that consumed this token. */
    gatewayRef?: string;
    /**
     * PayPal order id created (but not yet captured) against this token —
     * set by create-order, checked by capture-order so a capture request can
     * only ever complete the *same* PayPal order this exact token created,
     * never one created against a different token/invoice.
     */
    pendingGatewayRef?: string;
    /** fxRate locked in when pendingGatewayRef was created (see payment.service.ts's resolveGatewayCharge) — 1 if no conversion applied. */
    pendingFxRate?: number;
    /** The ReceiptPayment created from this successful payment. */
    receiptPaymentId?: Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const paymentTokenSchema = new Schema<IPaymentToken>(
    {
        jti: { type: String, required: true, unique: true, index: true },
        token: { type: String, required: true, unique: true },

        orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
        receiptId: { type: Schema.Types.ObjectId, ref: 'Receipt', required: true },
        quotationGroupId: { type: String, required: true },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },

        amountDue: { type: Number, required: true, min: 0 },
        currency: { type: String, required: true },

        status: {
            type: String,
            enum: ['active', 'consumed', 'void'],
            default: 'active',
            index: true,
        },
        expiresAt: { type: Date, required: true },

        consumedAt: { type: Date },
        consumedVia: { type: String, enum: ['stripe', 'paypal'] },
        gatewayRef: { type: String },
        pendingGatewayRef: { type: String },
        pendingFxRate: { type: Number },
        receiptPaymentId: { type: Schema.Types.ObjectId, ref: 'ReceiptPayment' },
    },
    { timestamps: true },
);

// One active token per order at a time is the common case (issuing a new one
// voids the previous — see PaymentService.issueTokenForOrder), so lookups by
// order scoped to "active" stay fast without needing a uniqueness constraint.
paymentTokenSchema.index({ orderId: 1, status: 1 });

const PaymentTokenModel = model<IPaymentToken>('PaymentToken', paymentTokenSchema);
export default PaymentTokenModel;
