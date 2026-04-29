import type { Request, Response } from 'express';
import QuotationModel from '../models/quotation.model.js';
import QuotationPaymentModel from '../models/quotation-payment.model.js';
import PaymentEventLogModel from '../models/payment-event-log.model.js';
import OutboxEventModel from '../models/outbox-event.model.js';
import OrderModel from '../models/order.model.js';
import { OutboxService } from '../services/outbox.service.js';
import { logger } from '../lib/logger.js';

type TimelineItem =
    | { kind: 'quotation'; at: string; data: any }
    | { kind: 'payment_event'; at: string; data: any }
    | { kind: 'outbox'; at: string; data: any }
    | { kind: 'order'; at: string; data: any };

function toAt(d: unknown) {
    const dt = d instanceof Date ? d : new Date(String(d));
    return dt.toISOString();
}

async function getTimeline(req: Request, res: Response) {
    const { quotationGroupId } = req.params;
    if (!quotationGroupId) {
        return res.status(400).json({ success: false, message: 'quotationGroupId is required' });
    }

    const [quotations, paymentTracker, paymentEvents, outboxEvents, order] = await Promise.all([
        QuotationModel.find({ quotationGroupId }).sort({ version: -1 }).lean(),
        QuotationPaymentModel.find({ quotationGroupId }).sort({ createdAt: -1 }).lean(),
        PaymentEventLogModel.find({ quotationGroupId }).sort({ createdAt: -1 }).lean(),
        OutboxEventModel.find({ aggregateId: quotationGroupId }).sort({ createdAt: -1 }).lean(),
        OrderModel.findOne({ quotationGroupId }).lean(),
    ]);

    const items: TimelineItem[] = [];

    for (const q of quotations) {
        items.push({
            kind: 'quotation',
            at: toAt(q.createdAt),
            data: {
                quotationId: q._id?.toString?.() ?? q._id,
                version: q.version,
                status: q.status,
                isLatestVersion: q.isLatestVersion,
                quotationNumber: q.quotationNumber,
                tokenExpiresAt: q.tokenExpiresAt,
                orderId: q.orderId?.toString?.() ?? q.orderId,
            },
        });
        if (q.updatedAt && q.updatedAt !== q.createdAt) {
            items.push({
                kind: 'quotation',
                at: toAt(q.updatedAt),
                data: {
                    quotationId: q._id?.toString?.() ?? q._id,
                    version: q.version,
                    status: q.status,
                    note: 'quotation.updated',
                },
            });
        }
    }

    for (const p of paymentTracker) {
        items.push({
            kind: 'quotation',
            at: toAt(p.createdAt),
            data: {
                note: 'payment.tracker.created',
                quotationPaymentId: p._id?.toString?.() ?? p._id,
                quotationId: p.quotationId?.toString?.() ?? p.quotationId,
                quotationVersion: p.quotationVersion,
                isActive: p.isActive,
                orderId: p.orderId?.toString?.() ?? p.orderId,
                phases: p.phases,
                totalAmount: p.totalAmount,
                currency: p.currency,
            },
        });
    }

    for (const e of paymentEvents) {
        items.push({
            kind: 'payment_event',
            at: toAt(e.createdAt),
            data: {
                eventLogId: e._id?.toString?.() ?? e._id,
                provider: e.provider,
                providerId: e.providerId,
                eventType: e.eventType,
                phase: e.phase,
                status: e.status,
                failureReason: e.failureReason,
                processedAt: e.processedAt,
                correlationId: e.correlationId,
            },
        });
    }

    for (const o of outboxEvents) {
        items.push({
            kind: 'outbox',
            at: toAt(o.createdAt),
            data: {
                outboxEventId: o._id?.toString?.() ?? o._id,
                eventName: o.eventName,
                status: o.status,
                attempts: o.attempts,
                maxAttempts: o.maxAttempts,
                lastError: o.lastError,
                nextAttemptAt: o.nextAttemptAt,
                correlationId: o.correlationId,
                causationId: o.causationId,
            },
        });
    }

    if (order) {
        items.push({
            kind: 'order',
            at: toAt(order.createdAt),
            data: {
                orderId: order._id?.toString?.() ?? order._id,
                orderNumber: order.orderNumber,
                status: order.status,
                orderType: order.orderType,
            },
        });
        for (const h of (order as any).statusHistory ?? []) {
            items.push({
                kind: 'order',
                at: toAt(h.updatedAt ?? h.createdAt ?? order.createdAt),
                data: {
                    orderId: order._id?.toString?.() ?? order._id,
                    orderNumber: order.orderNumber,
                    status: h.status,
                    note: h.note,
                    changedBy: h.changedBy?.toString?.() ?? h.changedBy,
                },
            });
        }
    }

    items.sort((a, b) => a.at.localeCompare(b.at));

    return res.status(200).json({
        success: true,
        data: {
            quotationGroupId,
            items,
        },
    });
}

async function requestReplay(req: Request, res: Response) {
    const { quotationGroupId } = req.params;
    const mode = String(req.body?.mode ?? 'failed_for_group');
    const ids = (req.body?.ids ?? []) as string[];

    if (!quotationGroupId) {
        return res.status(400).json({ success: false, message: 'quotationGroupId is required' });
    }

    const payload: Record<string, unknown> = {
        quotationGroupId,
        mode,
        ids,
        actorUserId: req.user?.id,
    };

    const doc = await OutboxService.enqueue({
        eventName: 'admin.outbox.replay',
        aggregateType: 'quotationGroup',
        aggregateId: quotationGroupId,
        payload,
    });

    const outboxEventId = doc?._id?.toString?.();

    logger.info(
        { quotationGroupId, mode, idsCount: Array.isArray(ids) ? ids.length : 0, outboxEventId },
        'admin.replay.requested',
    );

    return res.status(202).json({ success: true, data: { outboxEventId } });
}

async function requestRegenerateLink(req: Request, res: Response) {
    const { quotationGroupId } = req.params;
    if (!quotationGroupId) {
        return res.status(400).json({ success: false, message: 'quotationGroupId is required' });
    }

    const payload: Record<string, unknown> = {
        quotationGroupId,
        actorUserId: req.user?.id,
    };

    const evt = await OutboxService.enqueue({
        eventName: 'admin.quotation.regenerate_link',
        aggregateType: 'quotationGroup',
        aggregateId: quotationGroupId,
        payload,
    });

    logger.info(
        { quotationGroupId, actorUserId: req.user?.id, outboxEventId: evt?._id?.toString() },
        'admin.regenerate_link.requested',
    );

    return res.status(202).json({
        success: true,
        data: {
            outboxEventId: evt?._id?.toString(),
            note: 'Link regeneration enqueued. Refresh timeline to see updated token.',
        },
    });
}

export const QuotationTimelineController = {
    getTimeline,
    requestReplay,
    requestRegenerateLink,
};

