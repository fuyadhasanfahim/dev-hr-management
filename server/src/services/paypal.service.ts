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
