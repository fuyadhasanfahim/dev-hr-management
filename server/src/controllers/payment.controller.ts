import type { Request, Response, NextFunction } from 'express';
import type Stripe from 'stripe';
import {
    PaymentService,
    normalizeCurrencyForGateway,
    toStripeMinorUnits,
    fromStripeMinorUnits,
} from '../services/payment.service.js';
import { getStripeClient, getStripeWebhookSecret } from '../services/stripe.service.js';
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
 * already ran. Charges exactly `req.paymentCtx.amountDue` — the request body
 * carries only the token, nothing that could influence the charged amount.
 */
async function createStripeIntent(req: Request, res: Response, next: NextFunction) {
    try {
        const ctx = req.paymentCtx!;
        const stripe = getStripeClient();
        const gatewayCurrency = normalizeCurrencyForGateway(ctx.currency);

        // Idempotent on the token's jti: a page refresh or retry before the
        // customer pays reuses the same PaymentIntent instead of orphaning a
        // new one every time.
        const intent = await stripe.paymentIntents.create(
            {
                amount: toStripeMinorUnits(ctx.amountDue, gatewayCurrency),
                currency: gatewayCurrency,
                metadata: {
                    paymentTokenJti: ctx.tokenDoc.jti,
                    orderId: String(ctx.order._id),
                },
                automatic_payment_methods: { enabled: true },
            },
            { idempotencyKey: `pi_create_${ctx.tokenDoc.jti}` },
        );

        res.status(200).json({
            success: true,
            data: {
                clientSecret: intent.client_secret,
                amount: ctx.amountDue,
                currency: gatewayCurrency,
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
        const gatewayCurrency = normalizeCurrencyForGateway(resolved.currency);
        const capturedAmount = fromStripeMinorUnits(intent.amount_received, gatewayCurrency);

        await PaymentService.consumeAndRecordPayment(resolved, {
            amount: capturedAmount,
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

export default {
    getInvoiceByToken,
    createStripeIntent,
    stripeWebhook,
};
