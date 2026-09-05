import envConfig from '../config/env.config.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';

/**
 * Thin server-to-server REST wrapper around PayPal's Orders v2 API (no SDK —
 * PayPal's client credential flow is a handful of plain fetch calls). Every
 * call here talks directly to PayPal with our own client secret; nothing a
 * browser sends is ever trusted as proof of payment — see capturePaypalOrder.
 */

function assertConfigured(): void {
    if (!envConfig.paypal_client_id || !envConfig.paypal_client_secret || !envConfig.paypal_api_base_url) {
        throw new AppError('PayPal payments are not configured on this server.', 503);
    }
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
    assertConfigured();
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
        return cachedToken.accessToken;
    }

    const basic = Buffer.from(`${envConfig.paypal_client_id}:${envConfig.paypal_client_secret}`).toString('base64');
    const res = await fetch(`${envConfig.paypal_api_base_url}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        logger.error({ status: res.status, text }, 'paypal.oauth_token_failed');
        throw new AppError('Failed to authenticate with PayPal.', 502);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return cachedToken.accessToken;
}

async function paypalFetch(path: string, init: RequestInit = {}): Promise<any> {
    const token = await getAccessToken();
    const res = await fetch(`${envConfig.paypal_api_base_url}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });
    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
        logger.error({ status: res.status, body, path }, 'paypal.api_error');
        throw new AppError(body?.message || 'PayPal request failed.', 502);
    }
    return body;
}

export interface CreatedPaypalOrder {
    id: string;
    status: string;
}

/** Creates a PayPal order for the given amount. `referenceId` is our token's jti, purely for tracing in PayPal's dashboard. */
export async function createPaypalOrder(opts: {
    amount: number;
    currencyCode: string;
    referenceId: string;
}): Promise<CreatedPaypalOrder> {
    assertConfigured();
    const data = await paypalFetch('/v2/checkout/orders', {
        method: 'POST',
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: opts.referenceId,
                    amount: {
                        currency_code: opts.currencyCode,
                        value: opts.amount.toFixed(2),
                    },
                },
            ],
        }),
    });
    return { id: data.id, status: data.status };
}

export interface PaypalCaptureResult {
    orderId: string;
    status: string;
    captureId: string;
    capturedAmount: number;
    /** Lowercased, e.g. 'usd' — matches normalizeCurrencyForGateway's output. */
    capturedCurrency: string;
}

/**
 * Captures a previously created order. This IS the authoritative "did the
 * customer actually pay" check for PayPal — we call PayPal's own API with
 * our own credentials and read ITS response, never the browser's claim that
 * approval succeeded.
 */
export async function capturePaypalOrder(paypalOrderId: string): Promise<PaypalCaptureResult> {
    assertConfigured();
    const data = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
        method: 'POST',
    });

    const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture) {
        throw new AppError('PayPal capture response is missing capture details.', 502);
    }

    return {
        orderId: data.id,
        status: data.status,
        captureId: capture.id,
        capturedAmount: Number(capture.amount?.value) || 0,
        capturedCurrency: String(capture.amount?.currency_code || '').toLowerCase(),
    };
}
