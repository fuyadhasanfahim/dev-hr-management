import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import OrderModel, { type IOrder } from '../models/order.model.js';
import ReceiptModel from '../models/receipt.model.js';
import ClientModel from '../models/client.model.js';
import PaymentTokenModel, { type IPaymentToken } from '../models/payment-token.model.js';
import UserModel from '../models/user.model.js';
import { ReceiptService, type AddPaymentInput } from './receipt.service.js';
import earningService from './earning.service.js';
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
     * checks the DB-side single-use/rotation guard, then recomputes the
     * amount due live. Every public payment route must resolve its token
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
        // than silently accepting whatever the gateway reports.
        if (Math.abs(opts.amount - amountDue) > 0.01) {
            logger.error(
                { tokenId: String(tokenDoc._id), expected: amountDue, got: opts.amount, via: opts.via },
                'payment.amount_mismatch',
            );
            throw new AppError('Payment amount does not match the amount due on this invoice.', 409);
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
