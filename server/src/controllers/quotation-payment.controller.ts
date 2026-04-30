import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import { QuotationPaymentService } from '../services/quotation-payment.service.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';
import { QuotationService } from '../services/quotation.service.js';
import envConfig from '../config/env.config.js';
import { stripe } from '../services/stripe.service.js';
import ClientModel from '../models/client.model.js';
import emailService from '../services/email.service.js';
import OrderService from '../services/order.service.js';
import QuotationPaymentModel from '../models/quotation-payment.model.js';
import { reconcileOrders } from '../services/quotation-event.worker.js';
import OrderModel from '../models/order.model.js';

const VALID_PHASES = ['upfront', 'delivery', 'final'] as const;
type Phase = typeof VALID_PHASES[number];

// ─── Payment summary helper ────────────────────────────────────────────────────

/**
 * Derive frontend-ready computed fields from the raw tracker document.
 * All amounts are in the tracker's smallest currency unit (cents).
 */
function buildPaymentSummary(tracker: any) {
    const phases = VALID_PHASES;

    const paidPhases = phases.filter((p) => tracker.phases[p].status === 'paid');

    const totalPaid = phases.reduce(
        (sum, p) => sum + (tracker.phases[p].amountPaid ?? 0),
        0,
    );

    const remainingAmount = (tracker.totalAmount ?? 0) - totalPaid;

    const nextPayablePhase: Phase | null =
        tracker.phases.upfront.status !== 'paid'   ? 'upfront'
        : tracker.phases.delivery.status !== 'paid' ? 'delivery'
        : tracker.phases.final.status !== 'paid'    ? 'final'
        : null;

    const progressPercent =
        tracker.totalAmount > 0
            ? Math.round((totalPaid / tracker.totalAmount) * 100)
            : 0;

    return {
        paidPhases,
        totalPaid,
        remainingAmount,
        nextPayablePhase,
        progressPercent,
        allPaid: paidPhases.length === phases.length,
    };
}

/**
 * Create a Stripe PaymentIntent for a specific payment phase.
 *
 * Body: { quotationGroupId, phase, provider? }
 * Returns: { clientSecret, paymentIntentId, amountCents }
 */
async function createPaymentIntent(req: Request, res: Response, next: NextFunction) {
    try {
        const { quotationGroupId, phase, provider = 'stripe' } = req.body;

        if (!quotationGroupId) return next(new AppError('quotationGroupId is required', 400));
        if (!VALID_PHASES.includes(phase as Phase)) {
            return next(new AppError(`phase must be one of: ${VALID_PHASES.join(', ')}`, 400));
        }

        if (provider === 'stripe') {
            logger.info({ quotationGroupId, phase, provider }, 'payment.intent_create.requested');
            const result = await QuotationPaymentService.createStripePaymentIntent(
                quotationGroupId,
                phase as Phase,
            );
            logger.info({ quotationGroupId, phase, provider, paymentIntentId: result.paymentIntentId }, 'payment.intent_create.completed');
            return res.status(200).json({ success: true, data: result });
        }

        if (provider === 'paypal') {
            logger.info({ quotationGroupId, phase, provider }, 'payment.paypal_order_create.requested');
            const base = String(envConfig.payment_client_url || '').replace(/\/+$/, '');
            const result = await QuotationPaymentService.createPayPalOrder(
                quotationGroupId,
                phase as Phase,
                {
                    returnUrl: `${base}/success?from=quotation&method=paypal`,
                    cancelUrl: `${base}/quotations?cancelled=true`,
                },
            );
            logger.info({ quotationGroupId, phase, provider }, 'payment.paypal_order_create.completed');
            return res.status(200).json({ success: true, data: result });
        }

        return next(new AppError('provider must be stripe or paypal', 400));
    } catch (err) {
        return next(err);
    }
}

/**
 * Get the full payment phase status for a quotation group.
 */
async function getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const { groupId } = req.params;
        if (!groupId) return next(new AppError('groupId is required', 400));
        const result = await QuotationPaymentService.getPaymentStatus(groupId);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No payment tracker found. Quotation may not have been accepted yet.',
            });
        }
        return res.status(200).json({
            success: true,
            data: { ...result.toObject(), summary: buildPaymentSummary(result) },
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Public client route (token-authenticated via secure link).
 * POST /api/quotation-payments/client/:token/intent
 * Body: { phase, provider?: 'stripe' | 'paypal' }
 */
async function createClientPaymentIntent(req: Request, res: Response, next: NextFunction) {
    try {
        const { token } = req.params;
        const { phase, provider = 'stripe' } = req.body ?? {};

        if (!token) return next(new AppError('token is required', 400));
        if (!VALID_PHASES.includes(phase as Phase)) {
            return next(new AppError(`phase must be one of: ${VALID_PHASES.join(', ')}`, 400));
        }
        if (provider !== 'stripe' && provider !== 'paypal') {
            return next(new AppError('provider must be stripe or paypal', 400));
        }

        // Token is the credential. This also enforces expiry + latest-version constraints.
        const quotation = await QuotationService.getQuotationByToken(token);
        if (quotation.status !== 'accepted') {
            return next(new AppError('Quotation must be accepted before payment.', 409));
        }

        const quotationGroupId = quotation.quotationGroupId;
        logger.info({ quotationGroupId, phase, provider }, 'payment.client.intent_create.requested');

        if (provider === 'stripe') {
            const result = await QuotationPaymentService.createStripePaymentIntent(quotationGroupId, phase as Phase);
            return res.status(200).json({ success: true, data: result });
        }

        const base = String(envConfig.payment_client_url || '').replace(/\/+$/, '');
        const result = await QuotationPaymentService.createPayPalOrder(quotationGroupId, phase as Phase, {
            returnUrl: `${base}/success?from=quotation&method=paypal`,
            cancelUrl: `${base}/quotation/${encodeURIComponent(token)}?cancelled=true`,
        });
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return next(err);
    }
}

/**
 * Public client route (token-authenticated via secure link).
 * POST /api/quotation-payments/client/:token/capture
 * Body: { orderId }
 */
async function captureClientPayPalOrder(req: Request, res: Response, next: NextFunction) {
    try {
        const { token } = req.params;
        const { orderId } = req.body ?? {};

        if (!token) return next(new AppError('token is required', 400));
        if (!orderId) return next(new AppError('orderId is required', 400));

        // Token validation
        await QuotationService.getQuotationByToken(token);

        logger.info({ token, orderId }, 'payment.client.paypal_capture.requested');
        const result = await QuotationPaymentService.capturePayPalOrder(orderId);
        logger.info({ token, orderId }, 'payment.client.paypal_capture.completed');

        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return next(err);
    }
}

/**
 * Public client route (token-authenticated via secure link).
 * GET /api/quotation-payments/client/:token/status
 */
async function getClientPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const { token } = req.params;
        if (!token) return next(new AppError('token is required', 400));

        const quotation = await QuotationService.getQuotationByToken(token);
        const quotationGroupId = quotation.quotationGroupId;
        let result = await QuotationPaymentService.getPaymentStatus(quotationGroupId);

        // Fetch associated order to show assets/status in the payment UI
        const order = await mongoose.model('Order').findOne({ quotationGroupId }).select('status assets orderNumber').lean();

        // Dev/ops resilience: if the async worker hasn't initialized yet, self-heal here.
        // Only allowed once quotation is accepted.
        if (!result && quotation.status === 'accepted') {
            const clientId =
                typeof (quotation as any).clientId === 'object' && (quotation as any).clientId?._id
                    ? (quotation as any).clientId._id.toString()
                    : quotation.clientId.toString();
            result = await QuotationPaymentService.initializePaymentTracker(
                quotationGroupId,
                quotation._id.toString(),
                quotation.version,
                clientId,
                quotation.totals.grandTotal,
                quotation.currency || '৳',
            );
        }

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No payment tracker found. Quotation may not have been accepted yet.',
            });
        }

        return res.status(200).json({
            success: true,
            data: { 
                ...result.toObject(), 
                summary: buildPaymentSummary(result),
                order: order || null,
            },
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Public client route (token-authenticated via secure link).
 * POST /api/quotation-payments/client/:token/confirm
 *
 * Purpose:
 * - In local/dev, webhooks may not be configured; this endpoint confirms the payment
 *   directly and records it so trackers + orders update immediately.
 * - In prod, it is still safe: recordPhasePayment is idempotent by intent/capture id.
 *
 * Body:
 *  - phase: 'upfront' | 'delivery' | 'final'
 *  - provider: 'stripe' | 'paypal'
 *  - paymentIntentId?: string (stripe)
 *  - paypalCaptureId?: string (paypal)
 *  - amountCents?: number (paypal fallback / UI hint)
 *  - currency?: string
 */
async function confirmClientPayment(req: Request, res: Response, next: NextFunction) {
    try {
        const { token } = req.params;
        const {
            phase,
            provider = 'stripe',
            paymentIntentId,
            paypalCaptureId,
            amountCents,
            currency,
        } = req.body ?? {};

        if (!token) return next(new AppError('token is required', 400));
        if (!VALID_PHASES.includes(phase as Phase)) {
            return next(new AppError(`phase must be one of: ${VALID_PHASES.join(', ')}`, 400));
        }
        if (provider !== 'stripe' && provider !== 'paypal') {
            return next(new AppError('provider must be stripe or paypal', 400));
        }

        const quotation = await QuotationService.getQuotationByToken(token);
        if (quotation.status !== 'accepted') {
            return next(new AppError('Quotation must be accepted before payment.', 409));
        }

        const quotationGroupId = quotation.quotationGroupId;
        const quotationId = quotation._id.toString();

        let referenceId = '';
        let applied = false;
        let recordedAmountCents = 0;
        let recordedCurrency = '';
        let tracker: any;

        if (provider === 'stripe') {
            if (!paymentIntentId) return next(new AppError('paymentIntentId is required for stripe', 400));

            const pi = await stripe.paymentIntents.retrieve(String(paymentIntentId));
            if (!pi) return next(new AppError('Stripe payment intent not found', 404));
            if (pi.status !== 'succeeded') {
                return next(new AppError(`Stripe payment intent is '${pi.status}', not succeeded`, 409));
            }

            // Optional: assert metadata matches what we created server-side
            const md: any = (pi as any).metadata ?? {};
            if (md?.quotationGroupId && String(md.quotationGroupId) !== String(quotationGroupId)) {
                return next(new AppError('Payment intent does not belong to this quotation', 409));
            }
            if (md?.phase && String(md.phase) !== String(phase)) {
                return next(new AppError('Payment intent phase mismatch', 409));
            }

            const amt = Number((pi as any).amount_received ?? pi.amount ?? 0);
            const cur = String((pi as any).currency || currency || '').toUpperCase();

            const result = await QuotationPaymentService.recordPhasePayment(
                quotationGroupId,
                phase as Phase,
                amt,
                String(pi.id),
                quotationId,
                cur,
            );
            tracker = result.tracker;
            const wasApplied = result.wasApplied;

            referenceId = String(pi.id);
            applied = wasApplied;
            recordedAmountCents = amt;
            recordedCurrency = cur || tracker.currency;

            // Create/link order right after upfront fully paid (idempotent).
            if (phase === 'upfront' && tracker.phases.upfront.status === 'paid' && !tracker.orderId) {
                const order = await OrderService.createOrderFromQuotation(quotationGroupId, '000000000000000000000000');
                await QuotationPaymentModel.findOneAndUpdate(
                    { quotationGroupId, isActive: true },
                    { $set: { orderId: order._id } },
                );
            }
        } else {
            // PayPal: client provides capture id; amount/currency are used as best-effort hints.
            if (!paypalCaptureId) return next(new AppError('paypalCaptureId is required for paypal', 400));
            const amt = Number(amountCents);
            if (!Number.isFinite(amt) || amt <= 0) {
                return next(new AppError('amountCents (positive integer) is required for paypal confirmation', 400));
            }
            const cur = String(currency || '').toUpperCase();

            const result = await QuotationPaymentService.recordPhasePayment(
                quotationGroupId,
                phase as Phase,
                Math.round(amt),
                String(paypalCaptureId),
                quotationId,
                cur || undefined,
            );
            tracker = result.tracker;
            const wasApplied = result.wasApplied;

            referenceId = String(paypalCaptureId);
            applied = wasApplied;
            recordedAmountCents = Math.round(amt);
            recordedCurrency = cur || tracker.currency;

            if (phase === 'upfront' && tracker.phases.upfront.status === 'paid' && !tracker.orderId) {
                const order = await OrderService.createOrderFromQuotation(quotationGroupId, '000000000000000000000000');
                await QuotationPaymentModel.findOneAndUpdate(
                    { quotationGroupId, isActive: true },
                    { $set: { orderId: order._id } },
                );
            }
        }

        // Receipt emails: only send on first application to prevent duplicates on retries.
        if (applied) {
            try {
                const client = await ClientModel.findById(quotation.clientId).lean();
                const toList = Array.from(
                    new Set(
                        (client?.emails?.length ? client.emails : [quotation.client?.email])
                            .map((e: any) => String(e || '').trim())
                            .filter(Boolean),
                    ),
                );

                await Promise.all(
                    toList.map((to) =>
                        emailService.sendQuotationPaymentReceiptEmail({
                            to,
                            clientName: quotation.client?.contactName || client?.name || 'Client',
                            quotationNumber: quotation.quotationNumber,
                            phase: String(phase),
                            amountCents: recordedAmountCents,
                            currency: recordedCurrency || quotation.currency || 'USD',
                            referenceId,
                            provider: String(provider),
                            paidAt: new Date(),
                        }),
                    ),
                );

                const adminList = String(envConfig.payment_admin_emails || envConfig.smtp_user || '')
                    .split(',')
                    .map((e) => e.trim())
                    .filter(Boolean);

                await Promise.all(
                    adminList.map((to) =>
                        emailService.sendQuotationPaymentAdminEmail({
                            to,
                            clientName: quotation.client?.contactName || client?.name || 'Client',
                            quotationNumber: quotation.quotationNumber,
                            phase: String(phase),
                            amountCents: recordedAmountCents,
                            currency: recordedCurrency || quotation.currency || 'USD',
                            referenceId,
                            provider: String(provider),
                            paidAt: new Date(),
                        }),
                    ),
                );
            } catch (err: any) {
                logger.warn(
                    { quotationGroupId, phase, referenceId, err: err?.message || String(err) },
                    'payment.receipt_email_failed',
                );
            }
        }

        // Side effects for order-linked trackers (automated transitions)
        if (tracker.orderId) {
            const orderId = tracker.orderId.toString();
            try {
                if (phase === 'upfront' && tracker.phases.upfront.status === 'paid') {
                    // Transition to ACTIVE if not already there
                    const order = await OrderModel.findById(orderId);
                    if (order && order.status === 'pending_upfront') {
                        await OrderService.transitionStatus(
                            orderId,
                            'active' as any,
                            '000000000000000000000000',
                            'Order activated after manual upfront payment confirmation'
                        );
                    }
                } else if (phase === 'delivery' && tracker.phases.delivery.status === 'paid') {
                    // Unlock assets and transition to DELIVERED
                    await OrderService.unlockAssets(orderId);
                    logger.info({ orderId, phase }, 'payment.manual_confirm.delivery_side_effects_triggered');
                } else if (phase === 'final' && tracker.phases.final.status === 'paid') {
                    // Complete order
                    await OrderService.completeOrder(orderId);
                    logger.info({ orderId, phase }, 'payment.manual_confirm.final_side_effects_triggered');
                }
            } catch (err: any) {
                logger.error(
                    { orderId, phase, err: err?.message || String(err) },
                    'payment.manual_confirm.side_effects_failed'
                );
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                referenceId,
                paymentIntentId: provider === 'stripe' ? referenceId : undefined,
                paypalCaptureId: provider === 'paypal' ? referenceId : undefined,
                wasApplied: applied,
                phase,
                amountCents: recordedAmountCents,
                currency: recordedCurrency,
            },
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * Staff-only utility endpoint.
 * POST /api/quotation-payments/reconcile-orders
 *
 * Backfills missing orders for trackers where upfront is paid but orderId is missing.
 * Optional body: { systemActorId?: string }
 */
async function reconcileMissingOrders(req: Request, res: Response, next: NextFunction) {
    try {
        const systemActorId = String(req.body?.systemActorId || '000000000000000000000000');
        const result = await reconcileOrders(systemActorId);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return next(err);
    }
}

export default {
    createPaymentIntent,
    getPaymentStatus,
    createClientPaymentIntent,
    captureClientPayPalOrder,
    getClientPaymentStatus,
    confirmClientPayment,
    reconcileMissingOrders,
};
