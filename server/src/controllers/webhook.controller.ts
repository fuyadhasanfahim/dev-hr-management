import { type Request, type Response } from 'express';
import { stripe } from '../services/stripe.service.js';
import envConfig from '../config/env.config.js';
import PaymentEventLogModel from '../models/payment-event-log.model.js';
import { quotationPaymentEventQueue } from '../services/queue.service.js';
import { logger } from '../lib/logger.js';
import { createCorrelationId, createRequestId, runWithRequestContext } from '../lib/requestContext.js';
import { captureException } from '../lib/sentry.js';
import { getPayPalOrder, verifyPayPalWebhookSignature } from '../services/paypal.service.js';

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
        logger.warn(
            { err, provider: 'stripe' },
            'webhook.signature_verification_failed',
        );
        captureException(err, { provider: 'stripe', stage: 'signature_verification' });
        return res.status(400).send(`Webhook signature error: ${(err as Error).message}`);
    }

    // Only process events we care about
    const HANDLED_EVENTS = ['payment_intent.succeeded', 'payment_intent.payment_failed'];
    if (!HANDLED_EVENTS.includes(event.type)) {
        return res.status(200).json({ received: true, note: 'Event type not handled' });
    }

    const paymentIntent = event.data.object as any;
    const { quotationGroupId, phase, quotationId, correlationId: upstreamCorrelationId } = paymentIntent.metadata ?? {};
    const idempotencyKey = `stripe:${event.id}`;
    const correlationId =
        (upstreamCorrelationId && String(upstreamCorrelationId).trim()) ||
        (quotationGroupId ? `qg:${quotationGroupId}` : undefined) ||
        createCorrelationId();

    return await runWithRequestContext(
        {
            correlationId,
            requestId: req.requestId ?? createRequestId(),
        },
        async () => {

        // Step 2: Atomic idempotency insert — prevents duplicate processing
        let eventLogId: string;
        try {
            const logEntry = await new PaymentEventLogModel({
                idempotencyKey,
                provider: 'stripe',
                providerId: event.id,
                eventType: event.type,
                quotationGroupId: quotationGroupId || undefined,
                phase: phase || undefined,
                correlationId,
                amountReceived:
                    event.type === 'payment_intent.succeeded'
                        ? paymentIntent.amount_received
                        : undefined,
                currency: paymentIntent.currency?.toUpperCase(),
                rawPayload: event as any,
                status: 'pending',
            } as any).save();
            eventLogId = (logEntry as any)._id.toString();
        } catch (err: any) {
            // Duplicate key error (code 11000) = already processed
            if (err?.code === 11000) {
                logger.info(
                    { provider: 'stripe', providerEventId: event.id, eventType: event.type },
                    'webhook.duplicate_event',
                );
                return res.status(200).json({ received: true, note: 'Duplicate event, already processed' });
            }
            logger.error({ err, provider: 'stripe', providerEventId: event.id }, 'webhook.eventlog_insert_failed');
            captureException(err, { provider: 'stripe', stage: 'eventlog_insert', providerEventId: event.id });
            return res.status(500).send('Internal error during event logging');
        }

    // Step 3: Enqueue for async processing — return 200 immediately
        try {
            if (event.type === 'payment_intent.succeeded' && quotationGroupId && phase) {
                await quotationPaymentEventQueue.add(`payment.${phase}.succeeded`, {
                    eventLogId,
                    quotationGroupId,
                    quotationId: quotationId || undefined,
                    phase,
                    amountReceived: paymentIntent.amount_received,
                    paymentIntentId: paymentIntent.id,
                    systemActorId: '000000000000000000000000', // system actor ObjectId
                    correlationId,
                    aggregateType: 'quotationGroup',
                    aggregateId: quotationGroupId,
                });
            } else if (event.type === 'payment_intent.payment_failed' && quotationGroupId && phase) {
                await quotationPaymentEventQueue.add(`payment.${phase}.failed`, {
                    eventLogId,
                    quotationGroupId,
                    quotationId: quotationId || undefined,
                    phase,
                    paymentIntentId: paymentIntent.id,
                    correlationId,
                    aggregateType: 'quotationGroup',
                    aggregateId: quotationGroupId,
                });
            }
        } catch (err: any) {
            logger.error(
                { err, provider: 'stripe', providerEventId: event.id, eventType: event.type },
                'webhook.enqueue_failed',
            );
            captureException(err, { provider: 'stripe', stage: 'enqueue', providerEventId: event.id, eventType: event.type });
            await PaymentEventLogModel.findByIdAndUpdate(eventLogId, {
                $set: {
                    status: 'failed',
                    failureReason: err?.message || String(err),
                },
            });
            // Always 200: we store the event for later reprocessing.
            return res.status(200).json({ received: true, note: 'Enqueue failed; event logged for retry' });
        }

        // Always return 200 to Stripe — never let Stripe retry due to our internal errors
        return res.status(200).json({ received: true });
    });
}

// ─── PayPal Webhook ───────────────────────────────────────────────────────────

/**
 * Production-grade PayPal webhook handler.
 *
 * PayPal's custom_id field is used to encode: `${phase}::${quotationGroupId}`
 * This is set during PayPal order creation in QuotationPaymentService.createPayPalOrder().
 */
export async function paypalWebhook(req: Request, res: Response) {
    const event = req.body;

    // Step 1: signature verification (required in production)
    try {
        const transmissionId = String(req.header('paypal-transmission-id') || '');
        const transmissionTime = String(req.header('paypal-transmission-time') || '');
        const certUrl = String(req.header('paypal-cert-url') || '');
        const authAlgo = String(req.header('paypal-auth-algo') || '');
        const transmissionSig = String(req.header('paypal-transmission-sig') || '');

        if (
            envConfig.node_env === 'production' &&
            (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig)
        ) {
            return res.status(400).send('Missing PayPal transmission headers');
        }

        const ok = await verifyPayPalWebhookSignature({
            transmissionId,
            transmissionTime,
            certUrl,
            authAlgo,
            transmissionSig,
            webhookEvent: event,
        });

        if (!ok) {
            logger.warn({ provider: 'paypal' }, 'webhook.signature_verification_failed');
            return res.status(400).send('Invalid PayPal webhook signature');
        }
    } catch (err) {
        logger.error({ err, provider: 'paypal' }, 'webhook.signature_verification_error');
        captureException(err, { provider: 'paypal', stage: 'signature_verification' });
        return res.status(400).send(`PayPal webhook verification error: ${(err as Error).message}`);
    }

    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
        return res.status(200).json({ received: true, note: 'Event type not handled' });
    }

    const capture = event.resource;

    // PayPal capture webhook doesn't reliably include purchase_unit.custom_id.
    // We fetch the Order to read the encoded `custom_id` we set at order creation time.
    const orderId: string =
        capture?.supplementary_data?.related_ids?.order_id ||
        capture?.supplementary_data?.related_ids?.order ||
        '';

    if (!orderId) {
        logger.warn({ provider: 'paypal' }, 'webhook.missing_order_id');
        return res.status(200).json({ received: true, note: 'Missing order id' });
    }

    let customId = '';
    try {
        const order: any = await getPayPalOrder(orderId);
        customId = String(order?.purchase_units?.[0]?.custom_id || '');
    } catch (err) {
        logger.error({ err, provider: 'paypal', orderId }, 'webhook.order_fetch_failed');
        captureException(err, { provider: 'paypal', stage: 'order_fetch', orderId });
        // Return 200: event is valid but we couldn't enrich it; it can be replayed later.
        return res.status(200).json({ received: true, note: 'Order fetch failed' });
    }

    // Parse phase::quotationGroupId::quotationId::correlationId from custom_id
    const [phase, quotationGroupId, quotationId, correlationIdFromCustomId] = String(customId).split('::');
    if (!phase || !quotationGroupId) {
        logger.warn({ provider: 'paypal', customId, orderId }, 'webhook.missing_custom_id_encoding');
        return res.status(200).json({ received: true, note: 'Missing custom_id encoding' });
    }

    const idempotencyKey = `paypal:${event.id}`;
    const correlationId =
        (correlationIdFromCustomId && String(correlationIdFromCustomId).trim()) ||
        `qg:${quotationGroupId}`;

    return await runWithRequestContext(
        {
            correlationId,
            requestId: req.requestId ?? createRequestId(),
        },
        async () => {

        let eventLogId: string;
        try {
            const logEntry = await new PaymentEventLogModel({
                idempotencyKey,
                provider: 'paypal',
                providerId: event.id,
                eventType: event.event_type,
                quotationGroupId,
                phase,
                correlationId,
                amountReceived: Math.round(parseFloat(capture.amount.value) * 100), // convert to cents
                currency: capture.amount.currency_code,
                rawPayload: event as any,
                status: 'pending',
            } as any).save();
            eventLogId = (logEntry as any)._id.toString();
        } catch (err: any) {
            if (err?.code === 11000) {
                logger.info(
                    { provider: 'paypal', providerEventId: event.id, eventType: event.event_type },
                    'webhook.duplicate_event',
                );
                return res.status(200).json({ received: true, note: 'Duplicate event' });
            }
            logger.error({ err, provider: 'paypal', providerEventId: event.id }, 'webhook.eventlog_insert_failed');
            captureException(err, { provider: 'paypal', stage: 'eventlog_insert', providerEventId: event.id });
            return res.status(500).send('Internal error during event logging');
        }

        try {
            await quotationPaymentEventQueue.add(`payment.${phase}.succeeded`, {
                eventLogId,
                quotationGroupId,
                quotationId: quotationId || undefined,
                phase,
                amountReceived: Math.round(parseFloat(capture.amount.value) * 100),
                paymentIntentId: capture.id || orderId,
                systemActorId: '000000000000000000000000',
                correlationId,
                aggregateType: 'quotationGroup',
                aggregateId: quotationGroupId,
            });
        } catch (err: any) {
            logger.error(
                { err, provider: 'paypal', providerEventId: event.id, eventType: event.event_type },
                'webhook.enqueue_failed',
            );
            captureException(err, { provider: 'paypal', stage: 'enqueue', providerEventId: event.id, eventType: event.event_type });
            await PaymentEventLogModel.findByIdAndUpdate(eventLogId, {
                $set: {
                    status: 'failed',
                    failureReason: err?.message || String(err),
                },
            });
            return res.status(200).json({ received: true, note: 'Enqueue failed; event logged for retry' });
        }

        return res.status(200).json({ received: true });
    });
}
