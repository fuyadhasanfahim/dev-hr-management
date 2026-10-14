import { model, Schema, Types, type Document } from 'mongoose';

/**
 * A domain / hosting / support term that renews. The clock starts on the day the
 * quotation becomes an order (`startDate`), and `renewalDate = startDate + termMonths`.
 * Reminder sending is built on top of this record (offsets live in `reminderOffsetsDays`).
 */
export interface IServiceRenewal extends Document {
    orderId: Types.ObjectId;
    quotationId: Types.ObjectId;
    quotationGroupId: string;
    clientId: Types.ObjectId;
    key: string;
    label: string;
    kind: 'domain' | 'hosting' | 'support' | 'other';
    owner?: string;
    termMonths: number;
    startDate: Date;
    renewalDate: Date;
    status: 'active' | 'renewed' | 'cancelled' | 'expired';
    reminderOffsetsDays: number[];
    remindersSent: { offsetDays: number; sentAt: Date }[];
}

const serviceRenewalSchema = new Schema<IServiceRenewal>(
    {
        orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
        quotationId: { type: Schema.Types.ObjectId, ref: 'Quotation', required: true },
        quotationGroupId: { type: String, required: true },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
        key: { type: String, required: true },
        label: { type: String, required: true },
        kind: { type: String, enum: ['domain', 'hosting', 'support', 'other'], default: 'other' },
        owner: String,
        termMonths: { type: Number, required: true, min: 1 },
        startDate: { type: Date, required: true },
        renewalDate: { type: Date, required: true, index: true },
        status: { type: String, enum: ['active', 'renewed', 'cancelled', 'expired'], default: 'active', index: true },
        reminderOffsetsDays: { type: [Number], default: [] },
        remindersSent: { type: [{ _id: false, offsetDays: Number, sentAt: Date }], default: [] },
    },
    { timestamps: true },
);

// One timer per item per order — makes order creation retry-safe.
serviceRenewalSchema.index({ orderId: 1, key: 1 }, { unique: true });

export default model<IServiceRenewal>('ServiceRenewal', serviceRenewalSchema);
