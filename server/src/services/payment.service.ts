import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import OrderModel, { type IOrder } from '../models/order.model.js';
import ReceiptModel from '../models/receipt.model.js';
import ReceiptPaymentModel from '../models/receipt-payment.model.js';
import ClientModel from '../models/client.model.js';
import PaymentTokenModel, { type IPaymentToken } from '../models/payment-token.model.js';
import UserModel from '../models/user.model.js';
import { ReceiptService, type AddPaymentInput } from './receipt.service.js';
import earningService from './earning.service.js';
import { getUsdToBdtRate } from './fx-rate.service.js';
import { formatMoneyPdf } from './online-payment-receipt-pdf.service.js';
import notificationService from './notification.service.js';
import emailService from './email.service.js';
import {
    attachReceiptLedger,
    toInvoiceNumber,
    lineAmountFromService,
    CATEGORY_LABELS,
} from './invoice-puppeteer-pdf.service.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';
import envConfig from '../config/env.config.js';
import { PAYMENT_TOKEN_EXPIRY_DAYS } from '../constants/timing.js';

const PAYMENT_TOKEN_SECRET = envConfig.payment_token_secret;

interface PaymentTokenPayload {
    jti: string;
    orderId: string;
}

/**
 * Resolved, server-trusted context for one payment attempt. `amountDue` and
 * `currency` are recomputed live from the DB every time a token is resolved
 * (see `resolveActiveToken`) — never read from the JWT or from any
 * client-supplied field. This is the one object every payment route should
 * build its charge/capture amount from.
 */
export interface ResolvedPaymentToken {
    tokenDoc: IPaymentToken;
    order: IOrder;
    receiptId: Types.ObjectId;
    quotationGroupId: string;
    clientId: Types.ObjectId;
    amountDue: number;
    currency: string;
}

function resolveOrderTotals(order: Record<string, any>): { grandTotal: number; currency: string } {
    const snap = order.quotationSnapshot || {};
    const grandTotal =
        Number(snap.totals?.grandTotal) ||
        Number(snap.grandTotal) ||
        Number(order.totalPrice) ||
        0;
    const currency = snap.currency || order.currency || 'BDT';
    return { grandTotal, currency };
}

function signToken(payload: PaymentTokenPayload): string {
    return jwt.sign(payload, PAYMENT_TOKEN_SECRET, {
        expiresIn: `${PAYMENT_TOKEN_EXPIRY_DAYS}d`,
        algorithm: 'HS256',
    });
}

function verifyToken(token: string): PaymentTokenPayload {
    try {
        return jwt.verify(token, PAYMENT_TOKEN_SECRET, {
            algorithms: ['HS256'],
        }) as PaymentTokenPayload;
    } catch (err: any) {
        const expired = err?.name === 'TokenExpiredError';
        throw new AppError(expired ? 'This payment link has expired.' : 'Invalid payment link.', 410);
    }
}

/** DB-side status/expiry checks + a live amount-due recompute, shared by both token-resolution entry points. */
async function resolveFromTokenDoc(tokenDoc: IPaymentToken): Promise<ResolvedPaymentToken> {
    if (tokenDoc.status === 'consumed') {
        throw new AppError('This payment link has already been used.', 410);
    }
    if (tokenDoc.status === 'void') {
        throw new AppError('This payment link is no longer active. A newer invoice may have been issued.', 410);
    }
    if (tokenDoc.expiresAt <= new Date()) {
        throw new AppError('This payment link has expired.', 410);
    }

    const order = await OrderModel.findById(tokenDoc.orderId);
    if (!order) throw new AppError('Order not found', 404);

    const { grandTotal, currency } = resolveOrderTotals(order);
    const { balanceDue } = await attachReceiptLedger(order.quotationGroupId, grandTotal);

    if (balanceDue <= 0.009) {
        throw new AppError('This invoice has already been paid in full.', 409);
    }

    return {
        tokenDoc,
        order,
        receiptId: tokenDoc.receiptId,
        quotationGroupId: tokenDoc.quotationGroupId,
        clientId: tokenDoc.clientId,
        amountDue: balanceDue,
        currency,
    };
}

// ─── Gateway currency helpers ───────────────────────────────────────────────
// Quotations store currency as free-form display text ('৳', 'Tk', 'BDT',
// 'USD', ...). Gateways need a lowercase ISO-4217 code and (for Stripe) the
// amount in the currency's smallest unit. Centralized here so both gateways'
// controllers convert identically.

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
    '৳': 'bdt',
    tk: 'bdt',
    bdt: 'bdt',
    '$': 'usd',
    usd: 'usd',
};

/** Zero-decimal currencies per Stripe's docs — none of ours today, but kept explicit rather than assumed. */
const ZERO_DECIMAL_CURRENCIES = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);

export function normalizeCurrencyForGateway(currency: string): string {
    const key = String(currency ?? '').trim().toLowerCase();
    const mapped = CURRENCY_SYMBOL_MAP[key] ?? (/^[a-z]{3}$/.test(key) ? key : null);
    if (!mapped) {
        throw new AppError(`Currency "${currency}" is not supported for online payment.`, 422);
    }
    return mapped;
}

/** Converts a major-unit amount (e.g. 1500.50) into the integer smallest-unit amount Stripe expects. */
export function toStripeMinorUnits(amount: number, gatewayCurrency: string): number {
    const factor = ZERO_DECIMAL_CURRENCIES.has(gatewayCurrency) ? 1 : 100;
    return Math.round(amount * factor);
}

/** Inverse of `toStripeMinorUnits` — for reading `amount_received` back off a webhook event. */
export function fromStripeMinorUnits(minorAmount: number, gatewayCurrency: string): number {
    const factor = ZERO_DECIMAL_CURRENCIES.has(gatewayCurrency) ? 1 : 100;
    return minorAmount / factor;
}

/**
 * Currencies neither Stripe nor PayPal will charge in directly. The invoice,
 * the payment page, and the Receipt ledger stay in the invoice's native
 * currency throughout — only the gateway call itself uses the converted
 * amount (see resolveGatewayCharge/convertGatewayAmountToNative below).
 */
const GATEWAY_UNSUPPORTED_CURRENCIES = new Set(['bdt']);

export interface GatewayCharge {
    /** What to actually pass as the gateway's amount/currency. */
    chargeCurrency: string;
    chargeAmount: number;
    /** 1 unit of chargeCurrency = this many units of the invoice's native currency (1 if no conversion happened). Locked in at create-intent/create-order time and must be reused as-is when verifying the capture — never re-fetched, so a mid-flight rate update can't cause a false mismatch. */
    fxRate: number;
}

/**
 * Resolves what a gateway should actually be charged for this token: the
 * native currency/amount unchanged when the gateway supports it, or a
 * same-value USD conversion (at today's rate) when it doesn't.
 */
export async function resolveGatewayCharge(resolved: ResolvedPaymentToken): Promise<GatewayCharge> {
    const nativeCurrency = normalizeCurrencyForGateway(resolved.currency);

    if (!GATEWAY_UNSUPPORTED_CURRENCIES.has(nativeCurrency)) {
        return { chargeCurrency: nativeCurrency, chargeAmount: resolved.amountDue, fxRate: 1 };
    }

    if (nativeCurrency === 'bdt') {
        const usdToBdt = await getUsdToBdtRate();
        const chargeAmount = Math.round((resolved.amountDue / usdToBdt) * 100) / 100;
        // fxRate expresses "native units per 1 charge-currency unit" so the
        // inverse conversion below is a plain multiplication.
        return { chargeCurrency: 'usd', chargeAmount, fxRate: usdToBdt };
    }

    throw new AppError(`Currency "${resolved.currency}" is not supported for online payment.`, 422);
}

/**
 * Converts a gateway-reported captured amount back into the invoice's
 * native currency, using the *same* fxRate locked in at charge time (never a
 * freshly-fetched one) — so this is an exact inverse of resolveGatewayCharge,
 * not a fresh, potentially-drifted conversion.
 */
export function convertGatewayAmountToNative(capturedAmount: number, fxRate: number): number {
    return Math.round(capturedAmount * fxRate * 100) / 100;
}

// A synthetic "actor" for payments the client makes directly through the
// gateway (no staff member involved), so ReceiptPayment.createdBy — required,
// for a clean audit trail — always points at a real, dedicated user document
// rather than a null/staff id that didn't actually do anything.
const SYSTEM_USER_EMAIL = 'payments@system.internal';
let cachedSystemUserId: Types.ObjectId | null = null;

async function getOrCreateSystemUserId(): Promise<Types.ObjectId> {
    if (cachedSystemUserId) return cachedSystemUserId;

    const existing = await UserModel.findOne({ email: SYSTEM_USER_EMAIL });
    if (existing) {
        cachedSystemUserId = existing._id as unknown as Types.ObjectId;
        return cachedSystemUserId;
    }

    try {
        const { insertedId } = await UserModel.insertOne({
            name: 'Payment Gateway',
            email: SYSTEM_USER_EMAIL,
            role: 'System',
        } as any);
        cachedSystemUserId = insertedId as unknown as Types.ObjectId;
        return cachedSystemUserId;
    } catch (err: any) {
        // Lost a create race — another request just inserted the same row.
        if (err?.code === 11000) {
            const winner = await UserModel.findOne({ email: SYSTEM_USER_EMAIL });
            if (winner) {
                cachedSystemUserId = winner._id as unknown as Types.ObjectId;
                return cachedSystemUserId;
            }
        }
        throw err;
    }
}

export class PaymentService {
    /**
     * Mints (or reuses) the single active payment link/token for an order,
     * for embedding in the invoice's Pay Now URL. Returns `null` when the
     * order is already fully paid — callers should simply omit the Pay Now
     * button in that case rather than link to a dead-end.
     *
     * Issuing a *new* token (amount changed since the last one, e.g. a
     * partial payment landed since) voids any still-active token for this
     * order first, so an old emailed invoice's link stops working the moment
     * a fresher one exists — same rotation guarantee as the quotation's
     * secureToken.
     */
    static async issueTokenForOrder(
        orderId: string,
    ): Promise<{ token: string; amountDue: number; currency: string } | null> {
        const order = await OrderModel.findById(orderId).lean();
        if (!order) throw new AppError('Order not found', 404);

        const receipt = await ReceiptModel.findOne({ quotationGroupId: order.quotationGroupId })
            .select('_id')
            .lean();
        if (!receipt) throw new AppError('No receipt ledger found for this order', 404);

        const { grandTotal, currency } = resolveOrderTotals(order);
        const { balanceDue } = await attachReceiptLedger(order.quotationGroupId, grandTotal);

        if (balanceDue <= 0.009) return null;

        const existing = await PaymentTokenModel.findOne({
            orderId: order._id,
            status: 'active',
        });

        if (
            existing &&
            existing.expiresAt > new Date() &&
            Math.abs(existing.amountDue - balanceDue) < 0.01 &&
            existing.currency === currency
        ) {
            return { token: existing.token, amountDue: balanceDue, currency };
        }

        if (existing) {
            existing.status = 'void';
            await existing.save();
        }

        const jti = crypto.randomUUID();
        const token = signToken({ jti, orderId: String(order._id) });
        const expiresAt = new Date(Date.now() + PAYMENT_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        await PaymentTokenModel.create({
            jti,
            token,
            orderId: order._id,
            receiptId: receipt._id,
            quotationGroupId: order.quotationGroupId,
            clientId: order.clientId,
            amountDue: balanceDue,
            currency,
            status: 'active',
            expiresAt,
        });

        logger.info({ orderId: String(order._id), amountDue: balanceDue }, 'payment.token.issued');

        return { token, amountDue: balanceDue, currency };
    }

    /**
     * Verifies a raw token from a payment request (signature + expiry), then
     * hands off to the shared DB-side resolution. Every public payment route
     * (create-intent, create-order, capture-order) must resolve its token
     * through this — never decode the JWT and trust its payload directly.
     */
    static async resolveActiveToken(rawToken: string): Promise<ResolvedPaymentToken> {
        if (!rawToken || typeof rawToken !== 'string') {
            throw new AppError('Payment token is required.', 400);
        }

        const payload = verifyToken(rawToken);

        const tokenDoc = await PaymentTokenModel.findOne({ jti: payload.jti });
        if (!tokenDoc || tokenDoc.token !== rawToken) {
            throw new AppError('Invalid payment link.', 410);
        }

        return resolveFromTokenDoc(tokenDoc);
    }

    /**
     * Same DB-side validation + live-amount recompute as `resolveActiveToken`,
     * but keyed by `jti` instead of the raw JWT. For gateway webhooks: the
     * webhook payload never carries the client's original signed link (we
     * pass the `jti` as gateway metadata at create-intent/create-order time
     * instead), and the webhook's own signature verification is what proves
     * the request is genuinely from the gateway — a second JWT check adds
     * nothing there.
     */
    static async resolveActiveByJti(jti: string): Promise<ResolvedPaymentToken> {
        if (!jti) throw new AppError('Missing payment token reference.', 400);
        const tokenDoc = await PaymentTokenModel.findOne({ jti });
        if (!tokenDoc) throw new AppError('Invalid payment link.', 410);
        return resolveFromTokenDoc(tokenDoc);
    }

    /**
     * Records the PayPal order id created against this token (and the fxRate
     * locked in for it, if the charge currency differs from the invoice's
     * native currency), so a later capture-order call can be checked against
     * both — prevents completing a capture for a PayPal order created
     * against a *different* token/invoice, and guarantees the capture is
     * converted back with the exact rate that was quoted, not a fresh one.
     * No-op (silently) if the token is no longer active by the time this runs.
     */
    static async recordPendingGatewayRef(tokenId: Types.ObjectId, ref: string, fxRate: number): Promise<void> {
        await PaymentTokenModel.updateOne(
            { _id: tokenId, status: 'active' },
            { $set: { pendingGatewayRef: ref, pendingFxRate: fxRate } },
        );
    }

    /** Public, read-only invoice summary shown on the payment page. Never consumes the token. */
    static async getInvoiceSummary(resolved: ResolvedPaymentToken) {
        const { order, amountDue, currency } = resolved;
        const snap = (order.quotationSnapshot || {}) as Record<string, any>;
        const services: Record<string, any>[] = Array.isArray(snap.services) ? snap.services : [];
        const client = await ClientModel.findById(order.clientId).lean();

        return {
            invoiceNumber: toInvoiceNumber(snap.quotationNumber),
            quotationNumber: snap.quotationNumber || '',
            projectTitle: snap.details?.title || snap.templateName || order.orderNumber,
            currency,
            amountDue,
            client: {
                name: client?.name || snap.clientName || 'Client',
                email: client?.emails?.[0] || snap.clientEmail,
            },
            lines: services.map((s) => ({
                label: CATEGORY_LABELS[s?.category] || String(s?.category || 'Service'),
                sublabel: s?.scopeDescription || undefined,
                amount: lineAmountFromService(s),
            })),
        };
    }

    /**
     * Resolves an already-*consumed* token — for the success page and its
     * receipt download, which run *after* the payment that consumed the
     * token. Deliberately separate from resolveActiveToken (which rejects
     * consumed tokens): this is read-only and never touches payment state,
     * so letting it read a spent token is safe — it can't be used to pay
     * again, only to look back at the payment that already happened.
     */
    static async resolveConsumedToken(rawToken: string): Promise<ResolvedPaymentToken> {
        if (!rawToken || typeof rawToken !== 'string') {
            throw new AppError('Payment token is required.', 400);
        }
        const payload = verifyToken(rawToken);
        const tokenDoc = await PaymentTokenModel.findOne({ jti: payload.jti });
        if (!tokenDoc || tokenDoc.token !== rawToken) {
            throw new AppError('Invalid payment link.', 410);
        }
        if (tokenDoc.status !== 'consumed') {
            throw new AppError('No completed payment found for this link.', 404);
        }

        const order = await OrderModel.findById(tokenDoc.orderId);
        if (!order) throw new AppError('Order not found', 404);

        return {
            tokenDoc,
            order,
            receiptId: tokenDoc.receiptId,
            quotationGroupId: tokenDoc.quotationGroupId,
            clientId: tokenDoc.clientId,
            // Not "due" any more (it's paid) — kept for shape consistency;
            // callers of this path should read the actual paid amount off
            // the ReceiptPayment via getPaymentConfirmation instead.
            amountDue: tokenDoc.amountDue,
            currency: tokenDoc.currency,
        };
    }

    /** Confirmation summary for the success page + receipt PDF — built from a resolveConsumedToken result. */
    static async getPaymentConfirmation(resolved: ResolvedPaymentToken) {
        const { order, tokenDoc } = resolved;
        const snap = (order.quotationSnapshot || {}) as Record<string, any>;
        const client = await ClientModel.findById(order.clientId).lean();
        const payment = tokenDoc.receiptPaymentId
            ? await ReceiptPaymentModel.findById(tokenDoc.receiptPaymentId).lean()
            : null;

        if (!tokenDoc.gatewayRef || !tokenDoc.consumedVia || !payment) {
            throw new AppError('Payment confirmation is not available for this link.', 404);
        }

        return {
            clientName: client?.name || snap.clientName || 'Client',
            projectTitle: snap.details?.title || snap.templateName || order.orderNumber,
            quotationNumber: snap.quotationNumber || undefined,
            amount: payment.amount,
            currency: resolved.currency,
            paymentId: tokenDoc.gatewayRef,
            via: tokenDoc.consumedVia,
            paymentDate: payment.paymentDate,
        };
    }

    /**
     * Atomically consumes a resolved token and records the payment — the
     * core of the single-use guarantee. `resolved` must come straight out of
     * `resolveActiveToken` in the same request (its `amountDue` is what gets
     * charged/recorded; a caller must never substitute a client-supplied
     * amount here).
     *
     * The token flip (`active` → `consumed`) is a conditional update inside
     * the same transaction as the ReceiptPayment write, so a Stripe webhook
     * retry or a double-submitted capture can only ever win this race once —
     * the loser's conditional update matches zero documents and the whole
     * transaction aborts before any second payment row is written.
     */
    static async consumeAndRecordPayment(
        resolved: ResolvedPaymentToken,
        opts: {
            amount: number;
            via: 'stripe' | 'paypal';
            gatewayRef: string;
            method?: string;
        },
    ): Promise<{ receiptId: Types.ObjectId; paymentId: Types.ObjectId }> {
        const { tokenDoc, receiptId, amountDue } = resolved;

        // Defense in depth: even though the caller is expected to charge
        // exactly `amountDue`, refuse to record a mismatched amount rather
        // than silently accepting whatever the gateway reports. The
        // tolerance is relative (not a flat cent) because a currency-
        // converted charge (see resolveGatewayCharge) round-trips through
        // two roundings to 2 decimal places — a fixed cent tolerance would
        // be too tight for a large BDT amount and too loose for a small one.
        const tolerance = Math.max(0.01, amountDue * 0.0005);
        if (Math.abs(opts.amount - amountDue) > tolerance) {
            logger.error(
                { tokenId: String(tokenDoc._id), expected: amountDue, got: opts.amount, via: opts.via },
                'payment.amount_mismatch',
            );
            // 422, deliberately distinct from the 409s used for "already
            // consumed" elsewhere in this flow — callers (the Stripe/PayPal
            // webhook handlers) must NOT treat this one as safe-to-ignore.
            throw new AppError('Payment amount does not match the amount due on this invoice.', 422);
        }

        const systemUserId = await getOrCreateSystemUserId();
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const consumed = await PaymentTokenModel.findOneAndUpdate(
                { _id: tokenDoc._id, status: 'active' },
                { $set: { status: 'consumed', consumedAt: new Date(), consumedVia: opts.via, gatewayRef: opts.gatewayRef } },
                { new: true, session },
            );
            if (!consumed) {
                throw new AppError('This payment link has already been used.', 409);
            }

            const paymentType: AddPaymentInput['paymentType'] =
                amountDue - opts.amount <= 0.01 ? 'full' : 'partial';

            const { payment } = await ReceiptService.addPayment(
                String(receiptId),
                {
                    paymentType,
                    amount: opts.amount,
                    method: opts.method || opts.via,
                    note: `Paid online via ${opts.via} (ref: ${opts.gatewayRef})`,
                },
                String(systemUserId),
                session,
            );

            await PaymentTokenModel.updateOne(
                { _id: tokenDoc._id },
                { $set: { receiptPaymentId: payment._id } },
                { session },
            );

            await session.commitTransaction();

            logger.info(
                { tokenId: String(tokenDoc._id), receiptId: String(receiptId), amount: opts.amount, via: opts.via },
                'payment.consumed_and_recorded',
            );

            // Same best-effort side channel addPayment runs for staff-recorded
            // payments — deferred until after commit here since session-scoped
            // callers skip it (see the comment in ReceiptService.addPayment).
            try {
                await earningService.syncEarningFromReceipt(String(receiptId), String(systemUserId));
            } catch (err) {
                logger.error({ err, receiptId: String(receiptId) }, 'earning.sync_failed');
            }

            // Admin-facing notification + email, and the client-facing
            // receipt email — all best-effort, same reasoning as the earning
            // sync above: the payment already succeeded and is recorded, so
            // a notification/email hiccup must never turn into a 500 for a
            // customer whose card was already charged. Each runs
            // independently (Promise.allSettled) so one failing (e.g. a bad
            // client email on file) doesn't take the others down with it.
            const snap = (resolved.order.quotationSnapshot || {}) as Record<string, any>;
            const client = await ClientModel.findById(resolved.order.clientId).lean();
            const clientName = client?.name || snap.clientName || 'Client';
            const projectTitle = snap.details?.title || snap.templateName || resolved.order.orderNumber;
            const amountFormatted = formatMoneyPdf(opts.amount, resolved.currency);

            const results = await Promise.allSettled([
                notificationService.notifyAdminsOnlinePaymentReceived({
                    clientName,
                    projectTitle,
                    amountFormatted,
                    via: opts.via,
                    actorUserId: systemUserId,
                }),
                emailService.sendAdminPaymentReceiptEmail({
                    clientName,
                    projectTitle,
                    ...(snap.quotationNumber ? { quotationNumber: snap.quotationNumber } : {}),
                    amountFormatted,
                    paymentId: opts.gatewayRef,
                    via: opts.via,
                    paymentDateFormatted: new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    }),
                }),
                // The existing client-facing receipt flow (fuller template,
                // PDF attached) — reused as-is rather than duplicated; pulls
                // the client's email straight off the Client record.
                ReceiptService.sendReceipt(String(receiptId)),
            ]);

            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    logger.error(
                        { err: r.reason, tokenId: String(tokenDoc._id), receiptId: String(receiptId), step: i },
                        'payment.post_payment_notification_failed',
                    );
                }
            });

            return { receiptId: receiptId, paymentId: payment._id as unknown as Types.ObjectId };
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    }
}

export default PaymentService;
