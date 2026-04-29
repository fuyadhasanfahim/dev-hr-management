import crypto from 'crypto';
import type { ClientSession } from 'mongoose';
import OutboxEventModel, {
    type IOutboxEvent,
    type OutboxEventStatus,
} from '../models/outbox-event.model.js';

function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return String(value);
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function hashDedupe(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
}

export type EnqueueOutboxEventInput = {
    dedupeKey?: string;
    eventName: string;
    payload: Record<string, unknown>;
    aggregateType?: string;
    aggregateId?: string;
    correlationId?: string;
    causationId?: string;
    maxAttempts?: number;
};

export class OutboxService {
    static async enqueue(
        input: EnqueueOutboxEventInput,
        opts?: { session?: ClientSession },
    ): Promise<IOutboxEvent | null> {
        const computedKey =
            input.dedupeKey ||
            `${input.eventName}:${hashDedupe(
                `${input.aggregateType ?? ''}::${input.aggregateId ?? ''}::${stableStringify(input.payload)}`,
            )}`;

        try {
            const docToSave = new OutboxEventModel({
                dedupeKey: computedKey,
                eventName: input.eventName,
                aggregateType: input.aggregateType,
                aggregateId: input.aggregateId,
                correlationId: input.correlationId,
                causationId: input.causationId,
                payload: input.payload,
                status: 'pending',
                maxAttempts: input.maxAttempts ?? 10,
            });

            const saveOpts = opts?.session ? { session: opts.session } : undefined;
            const doc = await (saveOpts ? docToSave.save(saveOpts) : docToSave.save());

            return doc;
        } catch (err: any) {
            // Duplicate key => already enqueued; treat as idempotent success.
            if (err?.code === 11000) return null;
            throw err;
        }
    }

    static async claimNext(lockId: string, now = new Date()): Promise<IOutboxEvent | null> {
        const lockStaleBefore = new Date(now.getTime() - 5 * 60 * 1000);

        return OutboxEventModel.findOneAndUpdate(
            {
                $and: [
                    { status: { $in: ['pending', 'failed'] } },
                    {
                        $or: [
                            { nextAttemptAt: { $exists: false } },
                            { nextAttemptAt: { $lte: now } },
                        ],
                    },
                    {
                        $or: [
                            { lockedAt: { $exists: false } },
                            { lockedAt: { $lte: lockStaleBefore } },
                        ],
                    },
                ],
            },
            {
                $set: {
                    status: 'processing',
                    lockedAt: now,
                    lockId,
                },
            },
            { sort: { createdAt: 1 }, new: true },
        ).exec();
    }

    static async markProcessed(id: string, lockId: string) {
        await OutboxEventModel.updateOne(
            { _id: id, lockId, status: 'processing' },
            {
                $set: {
                    status: 'processed',
                    processedAt: new Date(),
                },
                $unset: {
                    lockedAt: 1,
                    lockId: 1,
                    nextAttemptAt: 1,
                    lastError: 1,
                },
            },
        ).exec();
    }

    static async markFailed(id: string, lockId: string, errorMessage: string) {
        const now = new Date();
        const doc = await OutboxEventModel.findOneAndUpdate(
            { _id: id, lockId, status: 'processing' },
            {
                $inc: { attempts: 1 },
                $set: { lastError: errorMessage },
            },
            { new: true },
        ).exec();

        if (!doc) return;

        const attempts = doc.attempts ?? 0;
        const maxAttempts = doc.maxAttempts ?? 10;

        if (attempts >= maxAttempts) {
            await OutboxEventModel.updateOne(
                { _id: id, lockId },
                {
                    $set: {
                        status: 'dead_letter',
                    },
                    $unset: {
                        lockedAt: 1,
                        lockId: 1,
                        nextAttemptAt: 1,
                    },
                },
            ).exec();
            return;
        }

        const backoffSeconds = Math.min(60 * 15, Math.pow(2, Math.max(0, attempts - 1)));
        const nextAttemptAt = new Date(now.getTime() + backoffSeconds * 1000);

        await OutboxEventModel.updateOne(
            { _id: id, lockId },
            {
                $set: {
                    status: 'failed',
                    nextAttemptAt,
                },
                $unset: {
                    lockedAt: 1,
                    lockId: 1,
                },
            },
        ).exec();
    }

    static async replayById(id: string) {
        await OutboxEventModel.updateOne(
            { _id: id, status: { $in: ['dead_letter', 'failed', 'cancelled'] } },
            {
                $set: {
                    status: 'pending',
                    nextAttemptAt: new Date(),
                },
                $unset: {
                    lockedAt: 1,
                    lockId: 1,
                    processedAt: 1,
                },
            },
        ).exec();
    }

    static async replayMany(ids: string[]) {
        await OutboxEventModel.updateMany(
            { _id: { $in: ids }, status: { $in: ['dead_letter', 'failed', 'cancelled'] } },
            {
                $set: {
                    status: 'pending',
                    nextAttemptAt: new Date(),
                },
                $unset: {
                    lockedAt: 1,
                    lockId: 1,
                    processedAt: 1,
                },
            },
        ).exec();
    }

    static async list(params: {
        status?: OutboxEventStatus;
        eventName?: string;
        page?: number;
        limit?: number;
    }) {
        const page = Math.max(1, Number(params.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20)));
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (params.status) filter.status = params.status;
        if (params.eventName) filter.eventName = params.eventName;

        const [items, total] = await Promise.all([
            OutboxEventModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            OutboxEventModel.countDocuments(filter),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
}

