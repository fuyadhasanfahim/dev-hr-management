import { QuotationPaymentService } from './quotation-payment.service.js';
import OrderService from './order.service.js';
import { logger } from '../lib/logger.js';
import mongoose from 'mongoose';
import { OutboxService } from './outbox.service.js';
import OutboxEventModel from '../models/outbox-event.model.js';
import QuotationModel from '../models/quotation.model.js';
import QuotationPaymentModel from '../models/quotation-payment.model.js';
import OrderModel from '../models/order.model.js';
import { QuotationService } from './quotation.service.js';

// ─── Event Handlers ───────────────────────────────────────────────────────────

export async function handleQuotationAccepted(data: any) {
    await QuotationPaymentService.initializePaymentTracker(
        data.quotationGroupId,
        data.quotationId,
        data.quotationVersion,
        data.clientId,
        data.grandTotal,
        data.currency,
    );
    logger.info(
        {
            quotationGroupId: data.quotationGroupId,
            quotationId: data.quotationId,
            quotationVersion: data.quotationVersion,
        },
        'quotation.accepted.tracker_initialized',
    );
}

export async function handleUpfrontPaymentSucceeded(data: any) {
    const log = logger.child({
        quotationGroupId: data.quotationGroupId,
        paymentIntentId: data.paymentIntentId,
        quotationId: data.quotationId,
    });

    log.info({ amountReceived: data.amountReceived }, 'payment.upfront.received');

    // Record the payment. Returns current tracker state regardless of wasApplied.
    // wasApplied=false means a duplicate/replay — but a prior run may have crashed
    // AFTER recording the payment and BEFORE creating the order. We must not skip
    // order creation based on wasApplied alone; use tracker.orderId as ground truth.
    const { tracker } = await QuotationPaymentService.recordPhasePayment(
        data.quotationGroupId,
        'upfront',
        data.amountReceived,
        data.paymentIntentId,
        data.quotationId,
    );

    // Guard: phase must be fully paid before creating an order (handles partial payments)
    if (tracker.phases.upfront.status !== 'paid') {
        log.info(
            { upfrontStatus: tracker.phases.upfront.status },
            'payment.upfront.succeeded.phase_not_fully_paid — order creation deferred',
        );
        return;
    }

    // Idempotency guard: order already exists and is linked — nothing left to do
    if (tracker.orderId) {
        log.info(
            { orderId: tracker.orderId.toString() },
            'payment.upfront.succeeded.order_already_linked — skipping creation',
        );
        return;
    }

    log.info('payment.upfront.succeeded.creating_order');

    try {
        const order = await OrderService.createOrderFromQuotation(
            data.quotationGroupId,
            data.systemActorId,
        );

        await QuotationPaymentModel.findOneAndUpdate(
            { quotationGroupId: data.quotationGroupId, isActive: true },
            { $set: { orderId: order._id } },
        );

        log.info(
            { orderId: order._id.toString(), orderNumber: order.orderNumber },
            'payment.upfront.succeeded.order_created',
        );
    } catch (err) {
        log.error({ err }, 'payment.upfront.succeeded.order_creation_failed');
        // Re-throw so the outbox worker retries this event
        throw err;
    }
}

export async function handleDeliveryPaymentSucceeded(data: any) {
    const { tracker, wasApplied } = await QuotationPaymentService.recordPhasePayment(
        data.quotationGroupId,
        'delivery',
        data.amountReceived,
        data.paymentIntentId,
        data.quotationId,
    );

    if (!wasApplied) {
        logger.info(
            { quotationGroupId: data.quotationGroupId, paymentIntentId: data.paymentIntentId },
            'payment.delivery.succeeded.replay — asset unlock skipped',
        );
        return;
    }

    if (tracker.orderId) {
        await OrderService.unlockAssets(tracker.orderId.toString());
        logger.info(
            { quotationGroupId: data.quotationGroupId, orderId: tracker.orderId.toString() },
            'payment.delivery.succeeded.assets_unlocked',
        );
    }
}

export async function handleFinalPaymentSucceeded(data: any) {
    const { tracker, wasApplied } = await QuotationPaymentService.recordPhasePayment(
        data.quotationGroupId,
        'final',
        data.amountReceived,
        data.paymentIntentId,
        data.quotationId,
    );

    if (!wasApplied) {
        logger.info(
            { quotationGroupId: data.quotationGroupId, paymentIntentId: data.paymentIntentId },
            'payment.final.succeeded.replay — order completion skipped',
        );
        return;
    }

    if (tracker.orderId) {
        await OrderService.completeOrder(tracker.orderId.toString());
        logger.info(
            { quotationGroupId: data.quotationGroupId, orderId: tracker.orderId.toString() },
            'payment.final.succeeded.order_completed',
        );
    }
}

export async function handleQuotationSuperseded(data: any) {
    logger.info({ quotationGroupId: data?.quotationGroupId }, 'quotation.superseded');
}

export async function handleQuotationChangeRequested(data: any) {
    logger.info({ quotationGroupId: data?.quotationGroupId, reason: data?.reason }, 'quotation.change_requested');
}

/**
 * Reconciliation safety net.
 *
 * Finds every active payment tracker whose upfront phase is fully paid but has
 * no orderId, then creates the missing order and links it.
 *
 * Two sub-cases handled:
 *  1. Order was never created (prior worker crash after payment recording).
 *  2. Order was created but the orderId back-reference was never written.
 *
 * Safe to call repeatedly — createOrderFromQuotation is idempotent.
 */
export async function reconcileOrders(systemActorId?: string): Promise<{
    fixed: number;
    repaired: number;
    errors: number;
}> {
    const log = logger.child({ fn: 'reconcileOrders' });
    log.info('reconcile.orders.start');

    const SYSTEM_ACTOR = systemActorId ?? '000000000000000000000000';

    const trackers = await QuotationPaymentModel.find({
        isActive: true,
        'phases.upfront.status': 'paid',
        orderId: { $exists: false },
    }).lean();

    log.info({ count: trackers.length }, 'reconcile.orders.candidates_found');

    let fixed = 0;
    let repaired = 0;
    let errors = 0;

    for (const tracker of trackers) {
        const quotationGroupId = tracker.quotationGroupId;
        const reconcileLog = log.child({ quotationGroupId });

        try {
            // Check whether the order already exists but just wasn't linked
            const existingOrder = await OrderModel.findOne({ quotationGroupId });
            if (existingOrder) {
                await QuotationPaymentModel.findByIdAndUpdate(tracker._id, {
                    $set: { orderId: existingOrder._id },
                });
                reconcileLog.info(
                    { orderId: existingOrder._id.toString() },
                    'reconcile.orders.link_repaired',
                );
                repaired++;
                continue;
            }

            const order = await OrderService.createOrderFromQuotation(quotationGroupId, SYSTEM_ACTOR);
            await QuotationPaymentModel.findByIdAndUpdate(tracker._id, {
                $set: { orderId: order._id },
            });
            reconcileLog.info(
                { orderId: order._id.toString(), orderNumber: order.orderNumber },
                'reconcile.orders.order_created',
            );
            fixed++;
        } catch (err) {
            reconcileLog.error({ err }, 'reconcile.orders.failed_for_group');
            errors++;
        }
    }

    log.info({ fixed, repaired, errors }, 'reconcile.orders.done');
    return { fixed, repaired, errors };
}

async function markPhaseFailed(data: any) {
    const phase = data?.phase;
    if (!phase) {
        logger.warn({ quotationGroupId: data?.quotationGroupId }, 'payment.failed.missing_phase');
        return;
    }

    await QuotationPaymentModel.findOneAndUpdate(
        {
            quotationGroupId: data.quotationGroupId,
            ...(data.quotationId ? { quotationId: new mongoose.Types.ObjectId(data.quotationId) } : { isActive: true }),
        },
        {
            $set: {
                [`phases.${phase}.status`]: 'failed',
            },
        },
    );

    logger.warn(
        {
            quotationGroupId: data?.quotationGroupId,
            quotationId: data?.quotationId,
            phase,
            paymentIntentId: data?.paymentIntentId,
        },
        'payment.phase_failed',
    );
}

export const quotationEventHandlers: Record<string, (payload: any) => Promise<void>> = {
    'quotation.accepted': handleQuotationAccepted,
    'quotation.superseded': handleQuotationSuperseded,
    'quotation.change_requested': handleQuotationChangeRequested,
    'payment.upfront.succeeded': handleUpfrontPaymentSucceeded,
    'payment.delivery.succeeded': handleDeliveryPaymentSucceeded,
    'payment.final.succeeded': handleFinalPaymentSucceeded,
    'payment.upfront.failed': markPhaseFailed,
    'payment.delivery.failed': markPhaseFailed,
    'payment.final.failed': markPhaseFailed,
    'admin.outbox.replay': async (payload: any) => {
        const quotationGroupId = payload?.quotationGroupId;
        const mode = String(payload?.mode ?? 'failed_for_group');
        const explicitIds = Array.isArray(payload?.ids) ? (payload.ids as string[]) : [];

        if (!quotationGroupId) {
            logger.warn({ mode }, 'admin.replay.missing_quotationGroupId');
            return;
        }

        let ids: string[] = explicitIds;
        if (ids.length === 0 && mode === 'failed_for_group') {
            const rows = await OutboxEventModel.find(
                {
                    aggregateId: quotationGroupId,
                    status: { $in: ['failed', 'dead_letter', 'cancelled'] },
                    eventName: { $ne: 'admin.outbox.replay' },
                },
                { _id: 1 },
            )
                .limit(200)
                .lean();
            ids = rows.map((r) => String(r._id));
        }

        if (ids.length === 0) {
            logger.info({ quotationGroupId, mode }, 'admin.replay.no_events_to_replay');
            return;
        }

        await OutboxService.replayMany(ids);
        logger.info({ quotationGroupId, mode, idsCount: ids.length }, 'admin.replay.enqueued');
    },
    'admin.quotation.regenerate_link': async (payload: any) => {
        const quotationGroupId = payload?.quotationGroupId;
        const actorUserId = payload?.actorUserId;
        if (!quotationGroupId) {
            logger.warn('admin.regenerate_link.missing_quotationGroupId');
            return;
        }

        const latest = await QuotationModel.findOne({ quotationGroupId, isLatestVersion: true });
        if (!latest) {
            logger.warn({ quotationGroupId }, 'admin.regenerate_link.no_latest_quotation');
            return;
        }

        await QuotationService.sendQuotation(latest._id.toString(), String(actorUserId || '000000000000000000000000'));
        logger.info({ quotationGroupId, quotationId: latest._id.toString() }, 'admin.regenerate_link.completed');
    },
};
