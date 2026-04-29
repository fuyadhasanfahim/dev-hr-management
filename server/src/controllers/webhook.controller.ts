import { type Request, type Response } from 'express';
import { stripe } from '../services/stripe.service.js';
import envConfig from '../config/env.config.js';
import PaymentEventLogModel from '../models/payment-event-log.model.js';
import { quotationPaymentEventQueue } from '../services/queue.service.js';

// ─── Stripe Webhook ───────────────────────────────────────────────────────────

/**
 * Production-grade Stripe webhook handler.
 *
 * Contract:
 *  1. Verify Stripe signature — reject immediately if invalid
 *  2. Attempt atomic insert into PaymentEventLog (unique idempotencyKey)
 *     - On duplicate key error → the event was already received → return 200
 *  3. Enqueue to BullMQ for async processing — return 200 immediately
 *
 * NO domain logic runs in this handler.
 * All side effects (order creation, asset unlock) happen in the event worker.
 */
export async function stripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];

    if (!sig || !envConfig.stripe_webhook_secret) {
        return res.status(400).send('Missing Stripe signature or webhook secret');
    }

    // Step 1: Signature verification (requires raw body — set in app.ts)
    let event: ReturnType<typeof stripe.webhooks.constructEvent>;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, envConfig.stripe_webhook_secret);
    } catch (err) {
        console.error(`[Webhook] Stripe signature verification failed: ${(err as Error).message}`);
        return res.status(400).send(`Webhook signature error: ${(err as Error).message}`);
    }

    // Only process events we care about
    const HANDLED_EVENTS = ['payment_intent.succeeded', 'payment_intent.payment_failed'];
    if (!HANDLED_EVENTS.includes(event.type)) {
        return res.status(200).json({ received: true, note: 'Event type not handled' });
    }

    const paymentIntent = event.data.object as any;
    const { quotationGroupId, phase } = paymentIntent.metadata ?? {};
    const idempotencyKey = `stripe:${event.id}`;

    // Step 2: Atomic idempotency insert — prevents duplicate processing
    let eventLogId: string;
    try {
        const logEntry = await PaymentEventLogModel.create({
            idempotencyKey,
            provider: 'stripe',
            providerId: event.id,
            eventType: event.type,
            quotationGroupId: quotationGroupId || undefined,
            phase: phase || undefined,
            amountReceived: event.type === 'payment_intent.succeeded'
                ? paymentIntent.amount_received
                : undefined,
            currency: paymentIntent.currency?.toUpperCase(),
            rawPayload: event,
            status: 'pending',
        });
        eventLogId = logEntry._id.toString();
    } catch (err: any) {
        // Duplicate key error (code 11000) = already processed
        if (err?.code === 11000) {
            console.log(`[Webhook] Duplicate Stripe event ${event.id} — skipping`);
            return res.status(200).json({ received: true, note: 'Duplicate event, already processed' });
        }
        console.error('[Webhook] Failed to insert PaymentEventLog:', err);
        return res.status(500).send('Internal error during event logging');
    }

    // Step 3: Enqueue for async processing — return 200 immediately
    if (event.type === 'payment_intent.succeeded' && quotationGroupId && phase) {
        await quotationPaymentEventQueue.add(`payment.${phase}.succeeded`, {
            eventLogId,
            quotationGroupId,
            phase,
            amountReceived: paymentIntent.amount_received,
            paymentIntentId: paymentIntent.id,
            systemActorId: '000000000000000000000000', // system actor ObjectId
        });
    } else if (event.type === 'payment_intent.payment_failed' && quotationGroupId && phase) {
        await quotationPaymentEventQueue.add(`payment.${phase}.failed`, {
            eventLogId,
            quotationGroupId,
            phase,
            paymentIntentId: paymentIntent.id,
        });
    }

    // Always return 200 to Stripe — never let Stripe retry due to our internal errors
    return res.status(200).json({ received: true });
}

// ─── PayPal Webhook ───────────────────────────────────────────────────────────

/**
 * Production-grade PayPal webhook handler.
 *
 * PayPal's custom_id field is used to encode: `${phase}::${quotationGroupId}`
 * This is set during PayPal order creation in QuotationPaymentService.createPayPalOrder().
 */
export async function paypalWebhook(req: Request, res: Response) {
    // TODO: Add PayPal webhook signature verification in production
    // Reference: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
    const event = req.body;

    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
        return res.status(200).json({ received: true, note: 'Event type not handled' });
    }

    const capture = event.resource;
    const customId: string = capture?.custom_id ?? '';

    // Parse phase::quotationGroupId from custom_id
    const [phase, quotationGroupId] = customId.split('::');
    if (!phase || !quotationGroupId) {
        console.error('[Webhook] PayPal event missing valid custom_id:', customId);
        return res.status(200).json({ received: true, note: 'Missing custom_id encoding' });
    }

    const idempotencyKey = `paypal:${event.id}`;

    let eventLogId: string;
    try {
        const logEntry = await PaymentEventLogModel.create({
            idempotencyKey,
            provider: 'paypal',
            providerId: event.id,
            eventType: event.event_type,
            quotationGroupId,
            phase,
            amountReceived: Math.round(parseFloat(capture.amount.value) * 100), // convert to cents
            currency: capture.amount.currency_code,
            rawPayload: event,
            status: 'pending',
        });
        eventLogId = logEntry._id.toString();
    } catch (err: any) {
        if (err?.code === 11000) {
            console.log(`[Webhook] Duplicate PayPal event ${event.id} — skipping`);
            return res.status(200).json({ received: true, note: 'Duplicate event' });
        }
        console.error('[Webhook] Failed to insert PaymentEventLog:', err);
        return res.status(500).send('Internal error during event logging');
    }

    await quotationPaymentEventQueue.add(`payment.${phase}.succeeded`, {
        eventLogId,
        quotationGroupId,
        phase,
        amountReceived: Math.round(parseFloat(capture.amount.value) * 100),
        paymentIntentId: capture.id,
        systemActorId: '000000000000000000000000',
    });

    return res.status(200).json({ received: true });
}
