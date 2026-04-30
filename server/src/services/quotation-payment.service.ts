import mongoose from 'mongoose';
import QuotationPaymentModel, {
    type IQuotationPayment,
    type PaymentPhaseStatus,
    type QuotationPaymentPhase,
} from '../models/quotation-payment.model.js';
import QuotationModel from '../models/quotation.model.js';
import { AppError } from '../utils/AppError.js';
import { stripe } from './stripe.service.js';
import { paypalClient, capturePayPalOrder } from './paypal.service.js';
import checkoutNodeJssdk from '@paypal/checkout-server-sdk';
import { getCorrelationId } from '../lib/requestContext.js';
import { logger } from '../lib/logger.js';

// Default split used when quotation.paymentMilestones is missing/invalid
const DEFAULT_PHASE_PERCENTAGES: Record<QuotationPaymentPhase, number> = {
    upfront: 50,
    delivery: 30,
    final: 20,
};

const VALID_PHASES = new Set<QuotationPaymentPhase>(['upfront', 'delivery', 'final']);

// 100 billion cents ($1B) — hard ceiling that prevents silent integer overflow
// on pathological inputs before they reach Stripe / the DB.
const MAX_AMOUNT_CENTS = 100_000_000_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize a raw currency value to a validated 2-4 letter ISO 4217 code.
 * Maps '৳' → 'BDT'. Throws AppError(400) on any invalid input.
 */
function normalizeCurrency(raw: unknown): string {
    if (raw == null) {
        throw new AppError('currency is required', 400);
    }
    const mapped = String(raw).trim().toUpperCase().replace(/^৳$/, 'BDT');
    if (!mapped) {
        throw new AppError('currency must not be empty', 400);
    }
    if (!/^[A-Z]{2,4}$/.test(mapped)) {
        throw new AppError(
            `currency '${mapped}' is not a valid ISO 4217 code (expected 2-4 uppercase letters)`,
            400,
        );
    }
    return mapped;
}

/**
 * Allocate a whole-cent amount from an already-rounded totalCents integer.
 * Uses Math.floor so any sub-cent remainder accumulates on the final phase,
 * which must always be computed as the arithmetic remainder:
 *   finalCents = totalCents - upfrontCents - deliveryCents
 * This guarantees upfront + delivery + final === totalCents exactly.
 *
 * @param totalCents  Single source of truth; must be a non-negative integer within MAX_AMOUNT_CENTS.
 * @param percentage  Per-phase split; must be a finite number in the open interval (0, 100).
 */
function allocatePhaseCents(totalCents: number, percentage: number): number {
    if (!Number.isInteger(totalCents) || totalCents < 0) {
        throw new AppError(
            `allocatePhaseCents: totalCents must be a non-negative integer, got ${totalCents}`,
            400,
        );
    }
    if (totalCents > MAX_AMOUNT_CENTS) {
        throw new AppError(
            `allocatePhaseCents: totalCents (${totalCents}) exceeds maximum allowed (${MAX_AMOUNT_CENTS})`,
            400,
        );
    }
    if (!Number.isFinite(percentage)) {
        throw new AppError(
            `allocatePhaseCents: percentage must be a finite number, got ${percentage}`,
            400,
        );
    }
    if (percentage <= 0 || percentage >= 100) {
        throw new AppError(
            `allocatePhaseCents: percentage must be in (0, 100) exclusive, got ${percentage}`,
            500,
        );
    }
    return Math.floor(totalCents * (percentage / 100));
}

function sanitizePercent(n: unknown): number | null {
    const num = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(num)) return null;
    // Each individual phase must be strictly between 0 and 100
    if (num <= 0 || num >= 100) return null;
    return num;
}

function resolvePhasePercentagesFromQuotation(quotation: any): Record<QuotationPaymentPhase, number> {
    const milestones = Array.isArray(quotation?.paymentMilestones) ? quotation.paymentMilestones : [];
    if (milestones.length !== 3) return DEFAULT_PHASE_PERCENTAGES;

    const percents: Array<number | null> = milestones.map((m: any) => sanitizePercent(m?.percentage));
    if (percents.some((p: number | null) => p === null)) return DEFAULT_PHASE_PERCENTAGES;

    // Round to 4 decimal places before comparing to absorb IEEE-754 representation
    // drift (e.g. 33.33 + 33.33 + 33.34 = 99.99999... in floating point).
    // Any deviation beyond 0.005 is a genuine data error — fall back to defaults.
    const sum = Math.round((percents[0]! + percents[1]! + percents[2]!) * 10_000) / 10_000;
    if (Math.abs(sum - 100) > 0.005) return DEFAULT_PHASE_PERCENTAGES;

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
        // ── Input validation ──────────────────────────────────────────────────
        if (!quotationGroupId || typeof quotationGroupId !== 'string' || !quotationGroupId.trim()) {
            throw new AppError('quotationGroupId must be a non-empty string', 400);
        }
        if (!quotationId || typeof quotationId !== 'string' || !quotationId.trim()) {
            throw new AppError('quotationId must be a non-empty string', 400);
        }
        if (!Number.isInteger(quotationVersion) || quotationVersion < 1) {
            throw new AppError(
                `quotationVersion must be a positive integer, got ${quotationVersion}`,
                400,
            );
        }
        if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
            throw new AppError('clientId must be a non-empty string', 400);
        }
        if (!Number.isFinite(grandTotal) || grandTotal < 0) {
            throw new AppError(
                `grandTotal must be a finite non-negative number, got ${grandTotal}`,
                400,
            );
        }
        if (grandTotal * 100 > MAX_AMOUNT_CENTS) {
            throw new AppError(
                `grandTotal (${grandTotal}) exceeds maximum allowed amount`,
                422,
            );
        }

        const normalizedCurrency = normalizeCurrency(currency);
        const totalCents = Math.round(grandTotal * 100);

        if (!Number.isInteger(totalCents) || totalCents < 0) {
            throw new AppError(
                `Derived totalCents (${totalCents}) is invalid — grandTotal may be malformed`,
                500,
            );
        }

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

        // upfront and delivery are floor-allocated from totalCents (the single source of truth).
        // final absorbs the remainder so the three values sum to totalCents exactly.
        const upfrontCents  = allocatePhaseCents(totalCents, percentages.upfront);
        const deliveryCents = allocatePhaseCents(totalCents, percentages.delivery);
        const finalCents    = totalCents - upfrontCents - deliveryCents;

        // Defensive: floor + sum-to-100 validation makes this unreachable under
        // correct inputs, but an upstream percentage bug must never silently produce
        // a negative amountDue that would confuse Stripe / PayPal.
        if (finalCents < 0) {
            throw new AppError(
                `Phase allocation error: upfront (${upfrontCents}¢) + delivery (${deliveryCents}¢) ` +
                `exceeds total (${totalCents}¢). ` +
                `Percentages: upfront=${percentages.upfront}%, delivery=${percentages.delivery}%, final=${percentages.final}%`,
                500,
            );
        }

        return QuotationPaymentModel.create({
            quotationGroupId,
            quotationId: new mongoose.Types.ObjectId(quotationId),
            quotationVersion,
            isActive: true,
            clientId: new mongoose.Types.ObjectId(clientId),
            currency: normalizedCurrency,
            totalAmount: totalCents,
            phases: {
                upfront: {
                    status: 'pending',
                    percentage: percentages.upfront,
                    amountDue: upfrontCents,
                    amountPaid: 0,
                },
                delivery: {
                    status: 'pending',
                    percentage: percentages.delivery,
                    amountDue: deliveryCents,
                    amountPaid: 0,
                },
                final: {
                    status: 'pending',
                    percentage: percentages.final,
                    amountDue: finalCents,
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

        // ── Input validation ──────────────────────────────────────────────────
        if (!quotationGroupId || typeof quotationGroupId !== 'string' || !quotationGroupId.trim()) {
            throw new AppError('quotationGroupId must be a non-empty string', 400);
        }
        if (!phase || !VALID_PHASES.has(phase)) {
            throw new AppError(
                `phase must be one of [${[...VALID_PHASES].join(', ')}], got '${phase}'`,
                400,
            );
        }

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

        if (!Number.isInteger(amountCents)) {
            throw new AppError(
                `Phase '${phase}' amountDue must be an integer in cents, got ${amountCents}`,
                400,
            );
        }
        if (amountCents <= 0) {
            throw new AppError(
                `Phase '${phase}' amountDue must be greater than 0 cents, got ${amountCents}`,
                422,
            );
        }
        if (amountCents > MAX_AMOUNT_CENTS) {
            throw new AppError(
                `Phase '${phase}' amountDue (${amountCents}¢) exceeds maximum allowed amount`,
                422,
            );
        }

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
            if (!existing.client_secret) {
                throw new AppError(
                    `Stripe PaymentIntent '${paymentIntentId}' has no client_secret — cannot proceed`,
                    500,
                );
            }
            clientSecret = existing.client_secret;
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
                    },
                    description: `${phase.toUpperCase()} payment (${tracker.phases[phase].percentage}%) — Quotation ${quotation.quotationNumber}`,
                },
                { idempotencyKey },
            );

            if (!intent.client_secret) {
                throw new AppError(
                    `Stripe returned a PaymentIntent (${intent.id}) with no client_secret`,
                    500,
                );
            }
            paymentIntentId = intent.id;
            clientSecret = intent.client_secret;

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
     *
     * Validation order (fail-fast, cheapest checks first):
     *  1. amountReceived is a positive integer (cents) — explicitly > 0
     *  2. Duplicate payment-intent — idempotent, wasApplied=false
     *  3. Phase already fully paid — idempotent, wasApplied=false
     *  4. Phase-order guard (upfront before delivery, delivery before final)
     *  5. Currency match — safe normalisation via String() + trim + uppercase
     *  6. Invariant: amountPaid <= amountDue (data-integrity gate)
     *  7. Overpayment guard — enforced in app AND re-asserted in atomic DB filter
     *
     * Returns { tracker, wasApplied } so callers can skip downstream side-effects
     * (order creation, asset unlock, order completion) on replay/no-op paths,
     * ensuring worker-level idempotency without relying solely on each downstream
     * service's own guard.
     *
     * State machine (recordPhasePayment never writes 'processing'):
     *   pending → processing (createStripePaymentIntent) → [partial →]* paid
     */
    static async recordPhasePayment(
        quotationGroupId: string,
        phase: QuotationPaymentPhase,
        amountReceived: number,  // positive integer, cents
        paymentIntentId: string,
        quotationId?: string,
        currency?: string,
    ): Promise<{ tracker: IQuotationPayment; wasApplied: boolean }> {

        // ── 1. Input validation ───────────────────────────────────────────────
        if (!quotationGroupId || typeof quotationGroupId !== 'string' || !quotationGroupId.trim()) {
            throw new AppError('quotationGroupId must be a non-empty string', 400);
        }
        if (!phase || !VALID_PHASES.has(phase)) {
            throw new AppError(
                `phase must be one of [${[...VALID_PHASES].join(', ')}], got '${phase}'`,
                400,
            );
        }
        if (!paymentIntentId || typeof paymentIntentId !== 'string' || !paymentIntentId.trim()) {
            throw new AppError('paymentIntentId must be a non-empty string', 400);
        }
        if (quotationId != null && (!quotationId.trim())) {
            throw new AppError('quotationId must be a non-empty string when provided', 400);
        }

        // amountReceived: must be a finite, positive integer in cents
        if (amountReceived == null || !Number.isFinite(amountReceived)) {
            throw new AppError(
                `amountReceived must be a finite number, got ${amountReceived}`,
                400,
            );
        }
        if (amountReceived <= 0) {
            throw new AppError(
                `amountReceived must be greater than 0 cents, got ${amountReceived}`,
                422,
            );
        }
        if (!Number.isInteger(amountReceived)) {
            throw new AppError(
                `amountReceived must be an integer (cents). Got: ${amountReceived}. ` +
                'Multiply by 100 and Math.round() before calling this method.',
                400,
            );
        }
        if (amountReceived > MAX_AMOUNT_CENTS) {
            throw new AppError(
                `amountReceived (${amountReceived}¢) exceeds maximum allowed amount`,
                422,
            );
        }

        const log = logger.child({ quotationGroupId, phase, paymentIntentId });
        log.info({ amountReceived }, 'payment.record_phase.start');

        const baseQuery = quotationId
            ? { quotationGroupId, quotationId: new mongoose.Types.ObjectId(quotationId) }
            : { quotationGroupId, isActive: true };

        const tracker = await QuotationPaymentModel.findOne(baseQuery);
        if (!tracker) throw new AppError('Payment tracker not found', 404);

        const phaseData = tracker.phases[phase];

        // ── 2. Duplicate payment-intent (checked before paid status) ──────────
        // Must run first: a re-delivered webhook for the intent that completed the
        // phase would otherwise be misread as an unrelated new payment attempt.
        if (phaseData.paidIntentIds.includes(paymentIntentId)) {
            log.info('payment.record_phase.duplicate_intent — no-op');
            return { tracker, wasApplied: false };
        }

        // ── 3. Already fully paid ─────────────────────────────────────────────
        if (phaseData.status === 'paid') {
            log.info('payment.record_phase.already_paid — no-op');
            return { tracker, wasApplied: false };
        }

        // ── 4. Phase-order guard ──────────────────────────────────────────────
        if (phase === 'delivery' && tracker.phases.upfront.status !== 'paid') {
            throw new AppError(
                `Cannot record delivery payment: upfront is '${tracker.phases.upfront.status}', must be 'paid'`,
                422,
            );
        }
        if (phase === 'final' && tracker.phases.delivery.status !== 'paid') {
            throw new AppError(
                `Cannot record final payment: delivery is '${tracker.phases.delivery.status}', must be 'paid'`,
                422,
            );
        }

        // ── 5. Currency validation — normalise then compare ──────────────────
        if (currency != null) {
            const normalised = normalizeCurrency(currency);
            if (normalised !== tracker.currency) {
                throw new AppError(
                    `Currency mismatch: tracker='${tracker.currency}', webhook='${normalised}'`,
                    422,
                );
            }
        }

        // ── 6. Invariant: amountPaid must not exceed amountDue ────────────────
        if (phaseData.amountPaid > phaseData.amountDue) {
            log.error(
                { amountPaid: phaseData.amountPaid, amountDue: phaseData.amountDue },
                'payment.record_phase.invariant_violation — amountPaid exceeds amountDue',
            );
            throw new AppError(
                `Data integrity error on phase '${phase}': ` +
                `amountPaid (${phaseData.amountPaid}) > amountDue (${phaseData.amountDue})`,
                500,
            );
        }

        // ── 7. Overpayment guard ──────────────────────────────────────────────
        const outstanding = phaseData.amountDue - phaseData.amountPaid;
        if (amountReceived > outstanding) {
            throw new AppError(
                `Overpayment rejected for phase '${phase}': ` +
                `outstanding ${outstanding} cents, received ${amountReceived} cents`,
                422,
            );
        }

        const newAmountPaid = phaseData.amountPaid + amountReceived;
        const newStatus: PaymentPhaseStatus =
            newAmountPaid >= phaseData.amountDue ? 'paid' : 'partial';
        const isFullyPaid = newStatus === 'paid';

        log.info(
            { newAmountPaid, amountDue: phaseData.amountDue, newStatus },
            'payment.record_phase.applying',
        );

        // ── Atomic update ─────────────────────────────────────────────────────
        // DB filter re-asserts guards atomically, closing the TOCTOU window:
        //   amountPaid + amountReceived <= amountDue
        //   ⟺  amountPaid <= amountDue - amountReceived
        const updated = await QuotationPaymentModel.findOneAndUpdate(
            {
                ...baseQuery,
                [`phases.${phase}.status`]:       { $nin: ['paid'] },
                [`phases.${phase}.paidIntentIds`]: { $nin: [paymentIntentId] },
                [`phases.${phase}.amountPaid`]:    { $lte: phaseData.amountDue - amountReceived },
            },
            {
                $inc:      { [`phases.${phase}.amountPaid`]: amountReceived },
                $addToSet: { [`phases.${phase}.paidIntentIds`]: paymentIntentId },
                $set: {
                    [`phases.${phase}.status`]:          newStatus,
                    [`phases.${phase}.paymentIntentId`]: paymentIntentId,
                    ...(isFullyPaid ? { [`phases.${phase}.paidAt`]: new Date() } : {}),
                },
            },
            { new: true },
        );

        // ── Fallback: atomic filter not matched ───────────────────────────────
        // App-level checks passed but the DB rejected the write. A concurrent
        // worker won the race. Re-fetch to get the definitive latest state and
        // classify what happened.
        if (!updated) {
            log.warn('payment.record_phase.atomic_miss — refetching current state');
            const current = await QuotationPaymentModel.findOne(baseQuery);
            if (!current) throw new AppError('Payment tracker vanished after atomic miss', 404);

            const currentPhase = current.phases[phase];

            if (currentPhase.paidIntentIds.includes(paymentIntentId)) {
                log.info('payment.record_phase.fallback.duplicate_intent — concurrent apply, no-op');
                return { tracker: current, wasApplied: false };
            }

            if (currentPhase.status === 'paid') {
                log.info('payment.record_phase.fallback.already_paid — concurrent completion, no-op');
                return { tracker: current, wasApplied: false };
            }

            // amountPaid was pushed past the safe threshold by a concurrent partial
            // before this write landed — suspicious, treat as overpayment attempt.
            log.warn(
                {
                    currentAmountPaid: currentPhase.amountPaid,
                    amountDue:         currentPhase.amountDue,
                    amountReceived,
                },
                'payment.record_phase.fallback.suspicious_extra_payment — concurrent overpayment blocked at DB level',
            );
            throw new AppError(
                `Concurrent overpayment blocked for phase '${phase}': ` +
                `amountPaid=${currentPhase.amountPaid}, amountDue=${currentPhase.amountDue}, ` +
                `attempted to add ${amountReceived} cents`,
                422,
            );
        }

        log.info(
            { newStatus, amountPaid: updated.phases[phase].amountPaid },
            'payment.record_phase.completed',
        );
        return { tracker: updated, wasApplied: true };
    }

    static async getPaymentStatus(quotationGroupId: string): Promise<IQuotationPayment | null> {
        return QuotationPaymentModel.findOne({ quotationGroupId, isActive: true });
    }

    static async capturePayPalOrder(orderId: string) {
        return capturePayPalOrder(orderId);
    }
}
