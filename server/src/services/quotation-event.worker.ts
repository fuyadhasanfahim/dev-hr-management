import { quotationPaymentEventQueue } from './queue.service.js';
import { QuotationPaymentService } from './quotation-payment.service.js';
import OrderService from './order.service.js';
import PaymentEventLogModel from '../models/payment-event-log.model.js';

// ─── Event Handlers ───────────────────────────────────────────────────────────

async function handleQuotationAccepted(data: any) {
    await QuotationPaymentService.initializePaymentTracker(
        data.quotationGroupId,
        data.clientId,
        data.grandTotal,
        data.currency,
    );
    console.log(`[EventBus] Payment tracker initialized for group ${data.quotationGroupId}`);
}

async function handleUpfrontPaymentSucceeded(data: any) {
    await QuotationPaymentService.recordPhasePayment(
        data.quotationGroupId,
        'upfront',
        data.amountReceived,
        data.paymentIntentId,
    );

    const order = await OrderService.createOrderFromQuotation(
        data.quotationGroupId,
        data.systemActorId,
    );

    // Update tracker with orderId
    const QuotationPaymentModel = (await import('../models/quotation-payment.model.js')).default;
    await QuotationPaymentModel.findOneAndUpdate(
        { quotationGroupId: data.quotationGroupId },
        { $set: { orderId: order._id } },
    );

    console.log(`[EventBus] Order ${order.orderNumber} created for group ${data.quotationGroupId}`);
}

async function handleDeliveryPaymentSucceeded(data: any) {
    await QuotationPaymentService.recordPhasePayment(
        data.quotationGroupId,
        'delivery',
        data.amountReceived,
        data.paymentIntentId,
    );

    const QuotationPaymentModel = (await import('../models/quotation-payment.model.js')).default;
    const tracker = await QuotationPaymentModel.findOne({ quotationGroupId: data.quotationGroupId });

    if (tracker?.orderId) {
        await OrderService.unlockAssets(tracker.orderId.toString());
        console.log(`[EventBus] Assets unlocked for order ${tracker.orderId}`);
    }
}

async function handleFinalPaymentSucceeded(data: any) {
    await QuotationPaymentService.recordPhasePayment(
        data.quotationGroupId,
        'final',
        data.amountReceived,
        data.paymentIntentId,
    );

    const QuotationPaymentModel = (await import('../models/quotation-payment.model.js')).default;
    const tracker = await QuotationPaymentModel.findOne({ quotationGroupId: data.quotationGroupId });

    if (tracker?.orderId) {
        await OrderService.completeOrder(tracker.orderId.toString());
        console.log(`[EventBus] Order ${tracker.orderId} marked as completed`);
    }
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Registers local event listeners. 
 * This replaces the BullMQ worker for Option B.
 */
export function registerQuotationEventWorker() {
    console.log('[EventBus] Registering local quotation event listeners...');

    const bus = quotationPaymentEventQueue;

    const wrapHandler = (name: string, handler: Function) => async (data: any) => {
        try {
            await handler(data);
            if (data?.eventLogId) {
                await PaymentEventLogModel.findByIdAndUpdate(data.eventLogId, {
                    $set: { status: 'processed', processedAt: new Date() },
                });
            }
        } catch (err: any) {
            console.error(`[EventBus] Handler ${name} failed:`, err.message);
        }
    };

    bus.on('quotation.accepted',          wrapHandler('accepted', handleQuotationAccepted));
    bus.on('payment.upfront.succeeded',  wrapHandler('upfront',  handleUpfrontPaymentSucceeded));
    bus.on('payment.delivery.succeeded', wrapHandler('delivery', handleDeliveryPaymentSucceeded));
    bus.on('payment.final.succeeded',    wrapHandler('final',    handleFinalPaymentSucceeded));
    
    // Add simple logging for other events
    bus.on('quotation.superseded', (data) => console.log(`[EventBus] Quotation superseded: ${data.quotationGroupId}`));
    bus.on('quotation.change_requested', (data) => console.log(`[EventBus] Change requested: ${data.reason}`));
}
