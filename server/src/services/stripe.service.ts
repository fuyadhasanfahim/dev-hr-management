import Stripe from 'stripe';
import type { IInvoice } from '../models/invoice.model.js';
import envConfig from '../config/env.config.js';

if (!envConfig.stripe_secret_key) {
    throw new Error('STRIPE_SECRET_KEY is missing in env');
}

export const stripe = new Stripe(envConfig.stripe_secret_key, {
    apiVersion: '2026-02-25.clover',
});

export async function createCheckoutSession(invoice: IInvoice, clientEmail: string) {
    const session = await stripe.checkout.sessions.create({
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
    });

    return session;
}
