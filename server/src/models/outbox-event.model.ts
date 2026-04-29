import { Schema, model, type Document } from 'mongoose';

export type OutboxEventStatus =
    | 'pending'
    | 'processing'
    | 'processed'
    | 'failed'
    | 'dead_letter'
    | 'cancelled';

export interface IOutboxEvent extends Document {
    /** Application-level dedupe key (unique). */
    dedupeKey: string;

    /** Logical event name (topic). */
    eventName: string;

    /** Optional pointers for debugging/admin. */
    aggregateType?: string;
    aggregateId?: string;
    correlationId?: string;
    causationId?: string;

    payload: Record<string, unknown>;

    status: OutboxEventStatus;

    attempts: number;
    maxAttempts: number;
    nextAttemptAt?: Date;

    lockedAt?: Date;
    lockId?: string;

    processedAt?: Date;
    lastError?: string;

    createdAt: Date;
    updatedAt: Date;
}

const outboxEventSchema = new Schema<IOutboxEvent>(
    {
        dedupeKey: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        eventName: { type: String, required: true, index: true },
        aggregateType: { type: String },
        aggregateId: { type: String, index: true, sparse: true },
        correlationId: { type: String, index: true, sparse: true },
        causationId: { type: String, index: true, sparse: true },
        payload: { type: Schema.Types.Mixed, required: true },
        status: {
            type: String,
            enum: ['pending', 'processing', 'processed', 'failed', 'dead_letter', 'cancelled'],
            default: 'pending',
            index: true,
        },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 10 },
        nextAttemptAt: { type: Date, index: true, sparse: true },
        lockedAt: { type: Date, index: true, sparse: true },
        lockId: { type: String, index: true, sparse: true },
        processedAt: { type: Date },
        lastError: { type: String },
    },
    {
        timestamps: true,
    },
);

outboxEventSchema.index({ status: 1, nextAttemptAt: 1, lockedAt: 1 });

const OutboxEventModel = model<IOutboxEvent>('OutboxEvent', outboxEventSchema);
export default OutboxEventModel;

