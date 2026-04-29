import { QuotationPaymentService } from './quotation-payment.service.js';
import OrderService from './order.service.js';
import { logger } from '../lib/logger.js';
import mongoose from 'mongoose';
import { OutboxService } from './outbox.service.js';
import OutboxEventModel from '../models/outbox-event.model.js';
import QuotationModel from '../models/quotation.model.js';
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
    await QuotationPaymentService.recordPhasePayment(
        data.quotationGroupId,
        'upfront',
        data.amountReceived,
        data.paymentIntentId,
        data.quotationId,
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

    logger.info(
        {
            quotationGroupId: data.quotationGroupId,
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
        },
        'payment.upfront.succeeded.order_created',
    );
}

export async function handleDeliveryPaymentSucceeded(data: any) {
    await QuotationPaymentService.recordPhasePayment(
        data.quotationGroupId,
        'delivery',
        data.amountReceived,
        data.paymentIntentId,
        data.quotationId,
    );

    const QuotationPaymentModel = (await import('../models/quotation-payment.model.js')).default;
    const tracker = await QuotationPaymentModel.findOne({ quotationGroupId: data.quotationGroupId });

    if (tracker?.orderId) {
        await OrderService.unlockAssets(tracker.orderId.toString());
        logger.info(
            { quotationGroupId: data.quotationGroupId, orderId: tracker.orderId.toString() },
            'payment.delivery.succeeded.assets_unlocked',
        );
    }
}

export async function handleFinalPaymentSucceeded(data: any) {
    await QuotationPaymentService.recordPhasePayment(
        data.quotationGroupId,
        'final',
        data.amountReceived,
        data.paymentIntentId,
        data.quotationId,
    );

    const QuotationPaymentModel = (await import('../models/quotation-payment.model.js')).default;
    const tracker = await QuotationPaymentModel.findOne({ quotationGroupId: data.quotationGroupId });

    if (tracker?.orderId) {
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

async function markPhaseFailed(data: any) {
    const QuotationPaymentModel = (await import('../models/quotation-payment.model.js')).default;
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
