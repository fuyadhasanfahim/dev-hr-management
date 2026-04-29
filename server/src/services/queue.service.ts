import crypto from 'crypto';
import { OutboxService } from './outbox.service.js';

class OutboxBackedQueue {
    async add(eventName: string, data: any) {
        const explicitDedupeKey =
            data?.dedupeKey ||
            data?.idempotencyKey ||
            (data?.eventLogId ? `eventLog:${data.eventLogId}` : undefined);

        const dedupeKey =
            explicitDedupeKey ||
            `${eventName}:${crypto
                .createHash('sha256')
                .update(JSON.stringify(data ?? {}))
                .digest('hex')}`;

        const doc = await OutboxService.enqueue({
            dedupeKey,
            eventName,
            payload: data ?? {},
            aggregateType: data?.aggregateType,
            aggregateId: data?.aggregateId,
            correlationId: data?.correlationId,
            causationId: data?.causationId,
        });

        return { id: doc?._id?.toString() ?? dedupeKey };
    }
}

export const quotationPaymentEventQueue = new OutboxBackedQueue();

// Dummy queues for compatibility with existing code
export const emailQueue = { add: async () => {} };
export const subscriptionQueue = { add: async () => {} };
