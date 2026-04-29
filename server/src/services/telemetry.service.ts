import PaymentEventLogModel from '../models/payment-event-log.model.js';
import OutboxEventModel from '../models/outbox-event.model.js';
import QuotationPaymentModel from '../models/quotation-payment.model.js';
import QuotationModel from '../models/quotation.model.js';
import { logger } from '../lib/logger.js';
import { captureMessage } from '../lib/sentry.js';

function numEnv(name: string, fallback: number) {
    const raw = process.env[name];
    const n = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(n) ? n : fallback;
}

export class TelemetryService {
    static async runHealthChecks(now = new Date()) {
        const windowMinutes = numEnv('ALERT_WINDOW_MINUTES', 10);
        const webhookFailureThreshold = numEnv('ALERT_WEBHOOK_FAILURES_THRESHOLD', 1);
        const outboxDeadLetterThreshold = numEnv('ALERT_OUTBOX_DEADLETTER_THRESHOLD', 1);
        const outboxFailedThreshold = numEnv('ALERT_OUTBOX_FAILED_THRESHOLD', 5);
        const stalledPaymentMinutes = numEnv('ALERT_STALLED_PAYMENT_MINUTES', 30);
        const expiredTokenThreshold = numEnv('ALERT_EXPIRED_TOKENS_THRESHOLD', 1);

        const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
        const stalledBefore = new Date(now.getTime() - stalledPaymentMinutes * 60 * 1000);

        const [
            webhookFailures,
            outboxDeadLetters,
            outboxFailed,
            stalledPayments,
            expiredTokens,
        ] = await Promise.all([
            PaymentEventLogModel.countDocuments({
                status: 'failed',
                createdAt: { $gte: windowStart },
            }),
            OutboxEventModel.countDocuments({
                status: 'dead_letter',
                createdAt: { $gte: windowStart },
            }),
            OutboxEventModel.countDocuments({
                status: 'failed',
                createdAt: { $gte: windowStart },
            }),
            QuotationPaymentModel.countDocuments({
                updatedAt: { $lte: stalledBefore },
                $or: [
                    { 'phases.upfront.status': 'processing' },
                    { 'phases.delivery.status': 'processing' },
                    { 'phases.final.status': 'processing' },
                ],
            }),
            QuotationModel.countDocuments({
                isLatestVersion: true,
                tokenExpiresAt: { $lt: now },
                status: { $in: ['sent', 'viewed', 'change_requested'] },
            }),
        ]);

        const signals: Array<{ name: string; count: number; threshold: number }> = [
            { name: 'webhook_failures', count: webhookFailures, threshold: webhookFailureThreshold },
            { name: 'outbox_dead_letter', count: outboxDeadLetters, threshold: outboxDeadLetterThreshold },
            { name: 'outbox_failed', count: outboxFailed, threshold: outboxFailedThreshold },
            { name: 'stalled_payments', count: stalledPayments, threshold: 1 },
            { name: 'expired_tokens', count: expiredTokens, threshold: expiredTokenThreshold },
        ];

        for (const s of signals) {
            if (s.count < s.threshold) continue;
            logger.warn({ signal: s.name, count: s.count, threshold: s.threshold }, 'telemetry.signal_triggered');
            captureMessage(`Health check signal: ${s.name}`, {
                level: 'warning',
                tags: { signal: s.name },
                extra: {
                    count: s.count,
                    threshold: s.threshold,
                    windowMinutes,
                    stalledPaymentMinutes,
                },
            });
        }
    }
}

