import Stripe from 'stripe';
import envConfig from '../config/env.config.js';
import { AppError } from '../utils/AppError.js';

let client: Stripe | null = null;

/**
 * Lazily-initialized Stripe client. Missing credentials is a valid,
 * unconfigured-feature state (see the soft-warn vars in env.config.ts) — this
 * throws a clear, request-scoped 503 rather than crashing the whole process
 * at boot, matching how ai-chat.service.ts's getAI() handles the same shape
 * of "optional integration, not yet configured" case.
 */
export function getStripeClient(): Stripe {
    if (client) return client;
    if (!envConfig.stripe_secret_key) {
        throw new AppError('Card payments are not configured on this server.', 503);
    }
    client = new Stripe(envConfig.stripe_secret_key, {
        apiVersion: '2026-08-26.dahlia',
    });
    return client;
}

export function getStripeWebhookSecret(): string {
    if (!envConfig.stripe_webhook_secret) {
        throw new AppError('Card payment webhooks are not configured on this server.', 503);
    }
    return envConfig.stripe_webhook_secret;
}
