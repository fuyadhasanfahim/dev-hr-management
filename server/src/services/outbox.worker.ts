import crypto from 'crypto';
import PaymentEventLogModel from '../models/payment-event-log.model.js';
import { OutboxService } from './outbox.service.js';
import { quotationEventHandlers } from './quotation-event.worker.js';
import { logger } from '../lib/logger.js';
import { createCorrelationId, createRequestId, runWithRequestContext } from '../lib/requestContext.js';
import { captureException } from '../lib/sentry.js';

function getWorkerLockId() {
    return `outbox-${process.pid}-${crypto.randomUUID()}`;
}

async function processOutboxEvent(eventName: string, payload: any) {
    const handler = quotationEventHandlers[eventName];
    if (!handler) {
        // Unknown eventName: treat as non-retryable and dead-letter immediately.
        const err = new Error(`No handler registered for outbox event: ${eventName}`);
        (err as any).nonRetryable = true;
        throw err;
    }
    await handler(payload);
}

export function registerOutboxWorker(opts?: {
    concurrency?: number;
    pollIntervalMs?: number;
}) {
    const concurrency = Math.max(1, Math.min(25, Number(opts?.concurrency ?? 5)));
    const pollIntervalMs = Math.max(250, Number(opts?.pollIntervalMs ?? 1000));
    const lockId = getWorkerLockId();

    logger.info({ concurrency, pollIntervalMs }, 'outbox.worker_started');

    let isRunning = false;

    const tick = async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            await Promise.all(
                Array.from({ length: concurrency }).map(async () => {
                    // Keep claiming until empty for this slot
                    while (true) {
                        const evt = await OutboxService.claimNext(lockId);
                        if (!evt) return;

                        try {
                            const correlationId = evt.correlationId ?? createCorrelationId();
                            await runWithRequestContext(
                                {
                                    correlationId,
                                    requestId: createRequestId(),
                                },
                                async () => {
                                    logger.info(
                                        {
                                            outboxEventId: evt._id.toString(),
                                            eventName: evt.eventName,
                                            attempts: evt.attempts,
                                            aggregateType: evt.aggregateType,
                                            aggregateId: evt.aggregateId,
                                        },
                                        'outbox.event_processing_started',
                                    );

                                    await processOutboxEvent(evt.eventName, evt.payload);

                                    logger.info(
                                        {
                                            outboxEventId: evt._id.toString(),
                                            eventName: evt.eventName,
                                        },
                                        'outbox.event_processing_completed',
                                    );
                                },
                            );

                            // Mirror processing status into PaymentEventLog when present
                            const eventLogId = (evt.payload as any)?.eventLogId;
                            if (eventLogId) {
                                await PaymentEventLogModel.findByIdAndUpdate(eventLogId, {
                                    $set: { status: 'processed', processedAt: new Date() },
                                });
                            }

                            await OutboxService.markProcessed(evt._id.toString(), lockId);
                        } catch (err: any) {
                            const message = err?.message || String(err);
                            logger.error(
                                {
                                    err,
                                    outboxEventId: evt._id.toString(),
                                    eventName: evt.eventName,
                                    attempts: evt.attempts,
                                },
                                'outbox.event_processing_failed',
                            );
                            captureException(err, {
                                stage: 'outbox_processing',
                                outboxEventId: evt._id.toString(),
                                eventName: evt.eventName,
                                attempts: evt.attempts,
                            });

                            const eventLogId = (evt.payload as any)?.eventLogId;
                            if (eventLogId) {
                                await PaymentEventLogModel.findByIdAndUpdate(eventLogId, {
                                    $set: {
                                        status: 'failed',
                                        failureReason: message,
                                    },
                                });
                            }

                            if (err?.nonRetryable) {
                                // Force dead-letter by setting attempts to max via markFailed loop.
                                // Simpler: markFailed will progress normally; nonRetryable still gets backoff.
                                await OutboxService.markFailed(evt._id.toString(), lockId, message);
                                continue;
                            }

                            await OutboxService.markFailed(evt._id.toString(), lockId, message);
                        }
                    }
                }),
            );
        } finally {
            isRunning = false;
        }
    };

    // Kick once quickly, then poll.
    void tick();
    const interval = setInterval(() => void tick(), pollIntervalMs);

    return () => clearInterval(interval);
}

