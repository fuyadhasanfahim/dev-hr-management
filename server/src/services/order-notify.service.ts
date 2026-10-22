import OrderModel, { OrderStatus } from '../models/order.model.js';
import PhotoOrderModel from '../models/photo-order.model.js';
import ClientModel from '../models/client.model.js';
import { logger } from '../lib/logger.js';
import { notify } from './notify.service.js';
import envConfig from '../config/env.config.js';

// Tells the client, on SMS + WhatsApp + email, whenever their order moves to a new status.
// Fire-and-forget by design: callers do `void notifyOrderStatus(...)` and the status change never depends on it.

const LINES: Record<string, (n: string) => string> = {
    pending: (n) => `We have received your order ${n} and will start on it shortly.`,
    in_progress: (n) => `Work has started on your order ${n}.`,
    quality_check: (n) => `Your order ${n} is in quality check.`,
    revision: (n) => `We received your revision request for order ${n} and our team is working on it.`,
    ready_to_deliver: (n) => `Your order ${n} is ready and will be delivered shortly.`,
    completed: (n) => `Your order ${n} has been completed.`,
    delivered: (n) => `Your order ${n} has been delivered. Thank you for choosing us!`,
    cancelled: (n) => `Your order ${n} has been cancelled. Please contact us if this is unexpected.`,
};
const label = (s: string) => s.replace(/_/g, ' ');

/** The text each channel carries for a status change. Exported so it can be checked without a database. */
export function orderStatusText(orderRef: string, status: string): string {
    return (LINES[status] ?? ((n: string) => `The status of your order ${n} is now ${label(status)}.`))(orderRef);
}

async function send(orderRef: string, clientId: unknown, status: string) {
    const client: any = await ClientModel.findById(clientId).select('name emails phone').lean();
    if (!client) return;
    const text = `${orderStatusText(orderRef, status)} - WebBriks`;
    await notify(
        { name: client.name, phone: client.phone, email: client.emails },
        {
            event: 'order.status',
            subject: `Order ${orderRef}: ${label(status)}`,
            text,
            emailFrom: 'Orders | WebBriks',
            ...(envConfig.wa_template_order_status
                ? { whatsappTemplate: { name: envConfig.wa_template_order_status, params: [client.name, orderRef, label(status)] } }
                : {}),
        },
    );
}

/** Project order (quotation → order) moved to `status`. */
export async function notifyOrderStatus(orderId: unknown, status: OrderStatus | string): Promise<void> {
    try {
        const order = await OrderModel.findById(orderId).select('orderNumber clientId').lean();
        if (order) await send(order.orderNumber, order.clientId, status);
    } catch (e) {
        logger.error({ orderId: String(orderId), err: e instanceof Error ? e.message : String(e) }, 'notify.order_status_failed');
    }
}

/** Photo-editing order moved to `status`. */
export async function notifyPhotoOrderStatus(orderId: unknown, status: string): Promise<void> {
    try {
        const order = await PhotoOrderModel.findById(orderId).select('orderName clientId').lean();
        if (order) await send(order.orderName, order.clientId, status);
    } catch (e) {
        logger.error({ orderId: String(orderId), err: e instanceof Error ? e.message : String(e) }, 'notify.photo_order_status_failed');
    }
}
