import mongoose from 'mongoose';
import QuotationPaymentModel, {
    type IQuotationPayment,
    type QuotationPaymentPhase,
} from '../models/quotation-payment.model.js';
import QuotationModel from '../models/quotation.model.js';
import { AppError } from '../utils/AppError.js';
import { stripe } from './stripe.service.js';
import { paypalClient } from './paypal.service.js';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';
import { getCorrelationId } from '../lib/requestContext.js';

// Default split used when quotation.paymentMilestones is missing/invalid
const DEFAULT_PHASE_PERCENTAGES: Record<QuotationPaymentPhase, number> = {
    upfront: 50,
    delivery: 30,
    final: 20,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute phase amount from grandTotal.
 * Returns integer cents (Stripe-compatible).
 */
function computePhaseAmount(grandTotal: number, percentage: number): number {
    return Math.round(grandTotal * (percentage / 100) * 100); // in cents
}

function sanitizePercent(n: unknown): number | null {
    const num = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(num)) return null;
    if (num <= 0 || num >= 100) return null;
    return num;
}

function resolvePhasePercentagesFromQuotation(quotation: any): Record<QuotationPaymentPhase, number> {
    const milestones = Array.isArray(quotation?.paymentMilestones) ? quotation.paymentMilestones : [];
    if (milestones.length !== 3) return DEFAULT_PHASE_PERCENTAGES;

    const percents: Array<number | null> = milestones.map((m: any) => sanitizePercent(m?.percentage));
    if (percents.some((p: number | null) => p === null)) return DEFAULT_PHASE_PERCENTAGES;

    const sum = Math.round((percents[0]! + percents[1]! + percents[2]!) * 100) / 100;
    // Accept minor floating error only
    if (Math.abs(sum - 100) > 0.01) return DEFAULT_PHASE_PERCENTAGES;

    return {
        upfront: percents[0]!,
        delivery: percents[1]!,
        final: percents[2]!,
    };
}

// ─── QuotationPaymentService ──────────────────────────────────────────────────

export class QuotationPaymentService {

    /**
     * Called by the event worker when quotation.accepted fires.
     * Creates the active payable (QuotationPayment) for the accepted latest quotation version.
     *
     * Invariant:
     *  - exactly one active payable per quotationGroupId (latest version only)
     *
     * IDEMPOTENT:
     *  - safe to call multiple times for the same quotationId (returns existing active payable)
     *  - safe under retries/concurrency via unique indexes.
     */
    static async initializePaymentTracker(
        quotationGroupId: string,
        quotationId: string,
        quotationVersion: number,
        clientId: string,
        grandTotal: number,
        currency: string,
    ): Promise<IQuotationPayment> {
        const totalCents = Math.round(grandTotal * 100);

        // Align payment split with quotation schema (paymentMilestones)
        const quotation = await QuotationModel.findById(quotationId).lean();
        const percentages = resolvePhasePercentagesFromQuotation(quotation);

        const existingForQuotation = await QuotationPaymentModel.findOne({
            quotationGroupId,
            quotationId: new mongoose.Types.ObjectId(quotationId),
        });
        if (existingForQuotation) {
            if (!existingForQuotation.isActive) {
                await QuotationPaymentModel.findByIdAndUpdate(existingForQuotation._id, {
                    $set: { isActive: true },
                    $unset: { supersededAt: '' },
                });
            }
            // Return the latest view (no in-memory mutation; plays nicely with exactOptionalPropertyTypes)
            const refreshed = await QuotationPaymentModel.findById(existingForQuotation._id);
            return (refreshed ?? existingForQuotation) as unknown as IQuotationPayment;
        }

        // Deactivate any previous active payable for this group (audit preserved)
        await QuotationPaymentModel.updateMany(
            { quotationGroupId, isActive: true },
            { $set: { isActive: false, supersededAt: new Date() } },
        );

        return QuotationPaymentModel.create({
            quotationGroupId,
            quotationId: new mongoose.Types.ObjectId(quotationId),
            quotationVersion,
            isActive: true,
            clientId: new mongoose.Types.ObjectId(clientId),
            currency: currency.toUpperCase() === '৳' ? 'BDT' : currency.toUpperCase(),
            totalAmount: totalCents,
            phases: {
                upfront: {
                    status: 'pending',
                    percentage: percentages.upfront,
                    amountDue: computePhaseAmount(grandTotal, percentages.upfront),
                    amountPaid: 0,
                },
                delivery: {
                    status: 'pending',
                    percentage: percentages.delivery,
                    amountDue: computePhaseAmount(grandTotal, percentages.delivery),
                    amountPaid: 0,
                },
                final: {
                    status: 'pending',
                    percentage: percentages.final,
                    amountDue: computePhaseAmount(grandTotal, percentages.final),
                    amountPaid: 0,
                },
            },
        });
    }

    /**
     * Create a Stripe PaymentIntent for a specific phase.
     *
     * SAFETY RULES enforced:
     *  1. quotation must be isLatestVersion = true
     *  2. phase must not already be 'paid'
     *  3. upfront must be paid before delivery can be initiated
     *  4. delivery must be paid before final can be initiated
     *
     * IDEMPOTENCY: Stripe idempotency key format: `stripe-{phase}-{quotationGroupId}`
     * Re-calling this returns the same PaymentIntent if one already exists.
     */
    static async createStripePaymentIntent(
        quotationGroupId: string,
        phase: QuotationPaymentPhase,
    ): Promise<{ clientSecret: string; paymentIntentId: string; amountCents: number }> {

        // Rule 1: Validate latest version exists and is accepted
        const quotation = await QuotationModel.findOne({
            quotationGroupId,
            isLatestVersion: true,
        });
        if (!quotation) {
            throw new AppError('No active quotation found for this group', 404);
        }
        if (quotation.status !== 'accepted') {
            throw new AppError(
                `Quotation must be accepted before payment. Current status: ${quotation.status}`,
                409,
            );
        }

        // Rule 2-4: Phase eligibility
        let tracker: any = await QuotationPaymentModel.findOne({
            quotationGroupId,
            quotationId: quotation._id,
            isActive: true,
        });
        if (!tracker) {
            // Retry-safe: if the accepted event worker hasn't initialized yet, do it here.
            tracker = await this.initializePaymentTracker(
                quotationGroupId,
                quotation._id.toString(),
                quotation.version,
                quotation.clientId.toString(),
                quotation.totals.grandTotal,
                quotation.currency || '৳',
            );
        }
        if (!tracker) {
            throw new AppError('Payment tracker not initialized. Quotation must be accepted first.', 422);
        }

        const phaseData = tracker.phases[phase];
        if (phaseData.status === 'paid') {
            throw new AppError(`Phase ${phase} has already been paid.`, 409);
        }

        if (phase === 'delivery' && tracker.phases.upfront.status !== 'paid') {
            throw new AppError('Upfront payment must be completed before delivery payment.', 409);
        }
        if (phase === 'final' && tracker.phases.delivery.status !== 'paid') {
            throw new AppError('Delivery payment must be completed before final payment.', 409);
        }

        const amountCents = phaseData.amountDue;
        const currency = tracker.currency.toLowerCase();
        // Include quotationId so new versions don't collide with old idempotency keys.
        const idempotencyKey = `stripe:${phase}:${quotation._id.toString()}`;

        // Create or retrieve existing PaymentIntent
        let paymentIntentId = phaseData.paymentIntentId;
        let clientSecret: string;

        if (paymentIntentId) {
            // Retrieve existing intent to get clientSecret
            const existing = await stripe.paymentIntents.retrieve(paymentIntentId);
            if (existing.status === 'succeeded') {
                throw new AppError(`Phase ${phase} PaymentIntent already succeeded.`, 409);
            }
            clientSecret = existing.client_secret!;
        } else {
            const intent = await stripe.paymentIntents.create(
                {
                    amount: amountCents,
                    currency,
                    metadata: {
                        quotationGroupId,
                        phase,
                        quotationId: quotation._id.toString(),
                        quotationVersion: String(quotation.version),
                        ...(getCorrelationId() ? { correlationId: getCorrelationId()! } : {}),
                    },
                    description: `${phase.toUpperCase()} payment (${tracker.phases[phase].percentage}%) — Quotation ${quotation.quotationNumber}`,
                },
                { idempotencyKey },
            );

            paymentIntentId = intent.id;
            clientSecret = intent.client_secret!;

            // Store the intent ID and mark as processing
            await QuotationPaymentModel.findOneAndUpdate(
                { quotationGroupId, quotationId: quotation._id, isActive: true },
                {
                    $set: {
                        [`phases.${phase}.paymentIntentId`]: paymentIntentId,
                        [`phases.${phase}.idempotencyKey`]: idempotencyKey,
                        [`phases.${phase}.status`]: 'processing',
                    },
                },
            );
        }

        return { clientSecret, paymentIntentId, amountCents };
    }

    /**
     * Create a PayPal order for a specific phase.
     */
    static async createPayPalOrder(
        quotationGroupId: string,
        phase: QuotationPaymentPhase,
        urls: { returnUrl: string; cancelUrl: string },
    ) {
        const quotation = await QuotationModel.findOne({ quotationGroupId, isLatestVersion: true });
        if (!quotation || quotation.status !== 'accepted') {
            throw new AppError('Quotation must be accepted before payment.', 409);
        }

        let tracker: any = await QuotationPaymentModel.findOne({
            quotationGroupId,
            quotationId: quotation._id,
            isActive: true,
        });
        if (!tracker) {
            tracker = await this.initializePaymentTracker(
                quotationGroupId,
                quotation._id.toString(),
                quotation.version,
                quotation.clientId.toString(),
                quotation.totals.grandTotal,
                quotation.currency || '৳',
            );
        }
        if (!tracker) throw new AppError('Payment tracker not found', 422);

        const phaseData = tracker.phases[phase];
        if (phaseData.status === 'paid') throw new AppError(`Phase ${phase} already paid`, 409);
        if (phase === 'delivery' && tracker.phases.upfront.status !== 'paid') {
            throw new AppError('Upfront must be paid first', 409);
        }
        if (phase === 'final' && tracker.phases.delivery.status !== 'paid') {
            throw new AppError('Delivery must be paid first', 409);
        }

        const amountDollars = (phaseData.amountDue / 100).toFixed(2);
        const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: `${phase}-${quotationGroupId}`,
                    // Encode version context to make handlers retry-safe across superseded versions.
                    custom_id: `${phase}::${quotationGroupId}::${quotation._id.toString()}::${getCorrelationId() ?? ''}`,
                    amount: {
                        currency_code: tracker.currency === 'BDT' ? 'USD' : tracker.currency,
                        value: amountDollars,
                    },
                    description: `${phase} payment for quotation group ${quotationGroupId}`,
                },
            ],
            application_context: {
                brand_name: 'Dev HR Agency',
                landing_page: 'BILLING',
                user_action: 'PAY_NOW',
                return_url: urls.returnUrl,
                cancel_url: urls.cancelUrl,
            },
        });

        const response = await paypalClient.execute(request);
        return response.result;
    }

    /**
     * Called by the event worker after a webhook confirms payment success.
     * Updates the phase status and emits a domain event for downstream effects.
     * IDEMPOTENT: If phase is already paid, this is a no-op.
     */
    static async recordPhasePayment(
        quotationGroupId: string,
        phase: QuotationPaymentPhase,
        amountReceived: number,  // in cents
        paymentIntentId: string,
        quotationId?: string,
    ): Promise<IQuotationPayment> {
        const tracker = await QuotationPaymentModel.findOne(
            quotationId
                ? { quotationGroupId, quotationId: new mongoose.Types.ObjectId(quotationId) }
                : { quotationGroupId, isActive: true },
        );
        if (!tracker) throw new AppError('Payment tracker not found', 404);

        // Idempotency: already paid, return as-is
        if (tracker.phases[phase].status === 'paid') {
            return tracker;
        }

        const updated = await QuotationPaymentModel.findOneAndUpdate(
            {
                quotationGroupId,
                ...(quotationId ? { quotationId: new mongoose.Types.ObjectId(quotationId) } : { isActive: true }),
                [`phases.${phase}.status`]: { $ne: 'paid' },
            },
            {
                $set: {
                    [`phases.${phase}.status`]: 'paid',
                    [`phases.${phase}.amountPaid`]: amountReceived,
                    [`phases.${phase}.paymentIntentId`]: paymentIntentId,
                    [`phases.${phase}.paidAt`]: new Date(),
                },
            },
            { new: true },
        );

        if (!updated) {
            // findOneAndUpdate returned null → phase was concurrently set to paid
            return tracker;
        }

        return updated;
    }

    static async getPaymentStatus(quotationGroupId: string): Promise<IQuotationPayment | null> {
        return QuotationPaymentModel.findOne({ quotationGroupId, isActive: true });
    }
}
