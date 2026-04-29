import Stripe from 'stripe';
import type { IInvoice } from '../models/invoice.model.js';
import envConfig from '../config/env.config.js';

if (!envConfig.stripe_secret_key) {
    throw new Error('STRIPE_SECRET_KEY is missing in env');
}

export const stripe = new Stripe(envConfig.stripe_secret_key, {
    apiVersion: '2026-02-25.clover',
});

// ─── Phase-based Payment Intent (Quotation Pipeline) ─────────────────────────

export interface CreatePhaseIntentParams {
    amountCents: number;
    currency: string;
    quotationGroupId: string;
    phase: 'upfront' | 'delivery' | 'final';
    quotationId: string;
    quotationNumber: string;
    idempotencyKey: string;
}

/**
 * Creates a Stripe PaymentIntent for a quotation payment phase.
 * Uses Stripe-level idempotency key to prevent duplicate intents.
 */
export async function createPaymentIntentForPhase(params: CreatePhaseIntentParams) {
    const intent = await stripe.paymentIntents.create(
        {
            amount: params.amountCents,
            currency: params.currency.toLowerCase(),
            metadata: {
                quotationGroupId: params.quotationGroupId,
                phase: params.phase,
                quotationId: params.quotationId,
            },
            description: `${params.phase} payment — Quotation ${params.quotationNumber}`,
        },
        { idempotencyKey: params.idempotencyKey },
    );
    return { clientSecret: intent.client_secret!, paymentIntentId: intent.id };
}

export async function createCheckoutSession(
    invoice: IInvoice,
    clientEmail: string,
    idempotencyKey?: string,
) {
    const session = await stripe.checkout.sessions.create(
        {
            payment_method_types: ['card'],
            customer_email: clientEmail,
            client_reference_id: invoice.clientId.toString(),
            metadata: {
                invoiceId: invoice._id.toString(),
                orderId: invoice.orderId ? invoice.orderId.toString() : '',
                projectId: invoice.projectId ? invoice.projectId.toString() : '',
            },
            line_items: invoice.items.map(item => ({
                price_data: {
                    currency: invoice.currency.toLowerCase(),
                    product_data: {
                        name: item.name,
                    },
                    unit_amount: Math.round(item.unitPrice * 100), // Stripe expects cents
                },
                quantity: item.quantity,
            })),
            mode: 'payment',
            success_url: `${envConfig.client_url}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${envConfig.client_url}/payment/cancel`,
        },
        idempotencyKey ? { idempotencyKey } : undefined,
    );

    return session;
}
