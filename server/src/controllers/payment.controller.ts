import type { Request, Response, NextFunction } from 'express';
import type Stripe from 'stripe';
import {
    PaymentService,
    toStripeMinorUnits,
    fromStripeMinorUnits,
    resolveGatewayCharge,
    convertGatewayAmountToNative,
} from '../services/payment.service.js';
import { getStripeClient, getStripeWebhookSecret } from '../services/stripe.service.js';
import { createPaypalOrder, capturePaypalOrder } from '../services/paypal.service.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';

/**
 * GET /api/payments/invoice/:token — public, read-only.
 * `resolvePaymentToken` middleware has already validated the token and
 * populated `req.paymentCtx`; this handler just shapes the response.
 */
async function getInvoiceByToken(req: Request, res: Response, next: NextFunction) {
    try {
        const summary = await PaymentService.getInvoiceSummary(req.paymentCtx!);
        res.status(200).json({ success: true, data: summary });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/payments/stripe/create-intent — public, `resolvePaymentToken`
 * already ran. Charges exactly `req.paymentCtx.amountDue`, converted to a
 * currency Stripe will accept if needed (Stripe doesn't take BDT, most of
 * our invoices are BDT) — see resolveGatewayCharge. The request body carries
 * only the token, nothing that could influence the charged amount.
 */
async function createStripeIntent(req: Request, res: Response, next: NextFunction) {
    try {
        const ctx = req.paymentCtx!;
        const stripe = getStripeClient();
        const charge = await resolveGatewayCharge(ctx);

        // Idempotent on the token's jti: a page refresh or retry before the
        // customer pays reuses the same PaymentIntent instead of orphaning a
        // new one every time.
        const intent = await stripe.paymentIntents.create(
            {
                amount: toStripeMinorUnits(charge.chargeAmount, charge.chargeCurrency),
                currency: charge.chargeCurrency,
                metadata: {
                    paymentTokenJti: ctx.tokenDoc.jti,
                    orderId: String(ctx.order._id),
                    // Locked in here, read back verbatim in the webhook — see
                    // resolveGatewayCharge's doc comment for why this must
                    // never be re-derived at confirmation time.
                    fxRate: String(charge.fxRate),
                },
                automatic_payment_methods: { enabled: true },
            },
            { idempotencyKey: `pi_create_${ctx.tokenDoc.jti}` },
        );

        res.status(200).json({
            success: true,
            data: {
                clientSecret: intent.client_secret,
                amount: charge.chargeAmount,
                currency: charge.chargeCurrency,
                // So the checkout UI can show "≈ $X" against the native BDT total if it wants to.
                nativeAmount: ctx.amountDue,
                nativeCurrency: ctx.currency,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/payments/stripe/webhook — Stripe calls this directly (never the
 * browser), verified by signature (STRIPE_WEBHOOK_SECRET), not by the
 * payment token — this is the one route in the payment module that does NOT
 * go through `resolvePaymentToken`. Registered in app.ts with `express.raw`
 * ahead of the global JSON body parser, since signature verification needs
 * the exact raw request bytes.
 *
 * This is the authoritative "the customer actually paid" signal — the
 * frontend's own success callback is for UX/redirect only and never itself
 * records a payment.
 */
async function stripeWebhook(req: Request, res: Response) {
    let event: Stripe.Event;
    try {
        const stripe = getStripeClient();
        const sig = req.headers['stripe-signature'];
        event = stripe.webhooks.constructEvent(req.body, sig as string, getStripeWebhookSecret());
    } catch (err) {
        logger.warn({ err }, 'payment.stripe.webhook_signature_invalid');
        res.status(400).send('Invalid signature');
        return;
    }

    if (event.type !== 'payment_intent.succeeded') {
        // Not an event we act on (e.g. payment_intent.created, .payment_failed) — ack and move on.
        res.status(200).json({ received: true });
        return;
    }

    const intent = event.data.object as Stripe.PaymentIntent;
    const jti = intent.metadata?.paymentTokenJti;

    try {
        if (!jti) throw new AppError('Stripe event missing paymentTokenJti metadata', 400);

        const resolved = await PaymentService.resolveActiveByJti(jti);
        const fxRate = Number(intent.metadata?.fxRate) || 1;
        const capturedInChargeCurrency = fromStripeMinorUnits(intent.amount_received, intent.currency);
        // Converts back with the *same* rate locked in at create-intent time
        // (fxRate is 1, a no-op, when the invoice's own currency was charged
        // directly) — never a freshly-fetched one.
        const nativeAmount = convertGatewayAmountToNative(capturedInChargeCurrency, fxRate);

        await PaymentService.consumeAndRecordPayment(resolved, {
            amount: nativeAmount,
            via: 'stripe',
            gatewayRef: intent.id,
            method: 'card',
        });

        res.status(200).json({ received: true });
    } catch (err: any) {
        // The card has already been charged by the time we get here — a
        // failure past this point means the customer paid but our ledger
        // doesn't reflect it yet. Log loudly for manual reconciliation.
        // "Already used" (a duplicate webhook delivery, which Stripe does
        // send) is expected and fine to ack; anything else needs a human.
        const alreadyHandled = err instanceof AppError && (err.statusCode === 410 || err.statusCode === 409);
        if (alreadyHandled) {
            res.status(200).json({ received: true, note: 'already processed' });
            return;
        }
        logger.error(
            { err, jti, paymentIntentId: intent.id, amountReceived: intent.amount_received },
            'payment.stripe.webhook_record_failed_after_charge',
        );
        // 500 so Stripe retries — most failure modes here (DB hiccup) are transient.
        res.status(500).json({ received: false });
    }
}

/**
 * POST /api/payments/paypal/create-order — public, `resolvePaymentToken`
 * already ran. Same amount rule as Stripe: always `req.paymentCtx.amountDue`,
 * converted to a currency PayPal will accept if needed (see
 * resolveGatewayCharge — PayPal doesn't take BDT either). The created order
 * id (and the fxRate used) are stamped onto the token so capture-order below
 * can only ever complete *this* order, converted back at the *same* rate.
 */
async function createPaypalOrderHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const ctx = req.paymentCtx!;
        const charge = await resolveGatewayCharge(ctx);

        const order = await createPaypalOrder({
            amount: charge.chargeAmount,
            currencyCode: charge.chargeCurrency.toUpperCase(),
            referenceId: ctx.tokenDoc.jti,
        });

        await PaymentService.recordPendingGatewayRef(ctx.tokenDoc._id, order.id, charge.fxRate);

        res.status(200).json({
            success: true,
            data: {
                orderId: order.id,
                amount: charge.chargeAmount,
                currency: charge.chargeCurrency.toUpperCase(),
                nativeAmount: ctx.amountDue,
                nativeCurrency: ctx.currency,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/payments/paypal/capture-order — public, `resolvePaymentToken`
 * already ran. The client tells us which PayPal order to capture, but that
 * claim is only ever used to call PayPal's own capture API; the actual
 * "did this succeed and for how much" comes from PayPal's response, not the
 * client's request.
 */
async function capturePaypalOrderHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const ctx = req.paymentCtx!;
        const paypalOrderId = req.body?.paypalOrderId;
        if (!paypalOrderId || typeof paypalOrderId !== 'string') {
            throw new AppError('paypalOrderId is required.', 400);
        }
        if (ctx.tokenDoc.pendingGatewayRef !== paypalOrderId) {
            throw new AppError('This PayPal order does not match the current payment link.', 400);
        }

        const capture = await capturePaypalOrder(paypalOrderId);
        if (capture.status !== 'COMPLETED') {
            throw new AppError(`PayPal payment was not completed (status: ${capture.status}).`, 402);
        }

        // Converts back with the *same* rate locked in at create-order time
        // (pendingFxRate is 1, a no-op, when the invoice's own currency was
        // charged directly) — never a freshly-fetched one.
        const fxRate = ctx.tokenDoc.pendingFxRate ?? 1;
        const nativeAmount = convertGatewayAmountToNative(capture.capturedAmount, fxRate);

        await PaymentService.consumeAndRecordPayment(ctx, {
            amount: nativeAmount,
            via: 'paypal',
            gatewayRef: capture.captureId,
            method: 'paypal',
        });

        res.status(200).json({ success: true, data: { status: 'completed' } });
    } catch (err) {
        next(err);
    }
}

export default {
    getInvoiceByToken,
    createStripeIntent,
    stripeWebhook,
    createPaypalOrderHandler,
    capturePaypalOrderHandler,
};
