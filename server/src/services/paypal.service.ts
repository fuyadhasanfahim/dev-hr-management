import checkoutNodeJssdk from '@paypal/checkout-server-sdk';
import type { IInvoice } from '../models/invoice.model.js';
import envConfig from '../config/env.config.js';

if (!envConfig.paypal_client_id || !envConfig.paypal_client_secret) {
    console.warn('PayPal environment variables are missing');
}

const environment = envConfig.node_env === 'production'
    ? new checkoutNodeJssdk.core.LiveEnvironment(envConfig.paypal_client_id || '', envConfig.paypal_client_secret || '')
    : new checkoutNodeJssdk.core.SandboxEnvironment(envConfig.paypal_client_id || '', envConfig.paypal_client_secret || '');

export const paypalClient = new checkoutNodeJssdk.core.PayPalHttpClient(environment);

function getPayPalApiBaseUrl() {
    return envConfig.node_env === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(): Promise<string> {
    if (!envConfig.paypal_client_id || !envConfig.paypal_client_secret) {
        throw new Error('PayPal credentials are missing');
    }

    const baseUrl = getPayPalApiBaseUrl();
    const auth = Buffer.from(`${envConfig.paypal_client_id}:${envConfig.paypal_client_secret}`).toString('base64');

    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`PayPal token request failed: ${res.status} ${text}`);
    }
    const json: any = await res.json();
    if (!json?.access_token) throw new Error('PayPal token response missing access_token');
    return String(json.access_token);
}

export async function verifyPayPalWebhookSignature(params: {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
    webhookEvent: unknown;
}): Promise<boolean> {
    if (!envConfig.paypal_webhook_id) {
        // In production we require signature verification. In non-prod, allow
        // local testing without a configured webhook id.
        if (envConfig.node_env === 'production') {
            throw new Error('PAYPAL_WEBHOOK_ID is missing');
        }
        return true;
    }

    const accessToken = await getAccessToken();
    const baseUrl = getPayPalApiBaseUrl();

    const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            transmission_id: params.transmissionId,
            transmission_time: params.transmissionTime,
            cert_url: params.certUrl,
            auth_algo: params.authAlgo,
            transmission_sig: params.transmissionSig,
            webhook_id: envConfig.paypal_webhook_id,
            webhook_event: params.webhookEvent,
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`PayPal webhook verify failed: ${res.status} ${text}`);
    }

    const json: any = await res.json();
    return String(json?.verification_status || '').toUpperCase() === 'SUCCESS';
}

export async function getPayPalOrder(orderId: string) {
    const request = new checkoutNodeJssdk.orders.OrdersGetRequest(orderId);
    const response = await paypalClient.execute(request);
    return response.result;
}

export async function createPayPalOrder(invoice: IInvoice) {
    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            reference_id: invoice._id.toString(),
            custom_id: invoice._id.toString(),
            amount: {
                currency_code: invoice.currency.toUpperCase(),
                value: invoice.dueAmount.toFixed(2)
            }
        }],
        application_context: {
            brand_name: 'Agency SaaS',
            landing_page: 'BILLING',
            user_action: 'PAY_NOW',
            return_url: `${envConfig.client_url}/payment/success`,
            cancel_url: `${envConfig.client_url}/payment/cancel`
        }
    });

    try {
        const response = await paypalClient.execute(request);
        return response.result;
    } catch (err) {
        throw new Error(`PayPal Order Creation Failed: ${(err as Error).message}`);
    }
}
