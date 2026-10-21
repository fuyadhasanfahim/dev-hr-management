import { Schema, model, Document, Types } from 'mongoose';

/**
 * One row per thing the client must be reminded about: either an order's unpaid balance
 * (`due`) or one recurring monthly/yearly charge (`recurring`). Both share the same
 * lifecycle so the dialog, the page and the cron treat them identically.
 *
 *   awaiting_decision → admin has not yet chosen when to remind
 *   scheduled         → will be emailed when `sendAt` passes
 *   paused / cancelled → no emails; admin can reschedule
 *   done              → due balance fully paid
 */
export type ReminderKind = 'due' | 'recurring';
export type ReminderStatus = 'awaiting_decision' | 'scheduled' | 'paused' | 'cancelled' | 'done';

export interface IPaymentReminder extends Document {
    kind: ReminderKind;
    orderId: Types.ObjectId;
    receiptId?: Types.ObjectId;
    clientId: Types.ObjectId;
    orderNumber: string;
    clientName: string;
    title: string;
    amount: number;
    currency: string;
    cycle?: 'monthly' | 'yearly';
    status: ReminderStatus;
    sendAt?: Date;
    /** Recurring only: the cycle currently owed. Moves forward one cycle each time it is marked paid. */
    dueDate?: Date;
    lastPaidAt?: Date;
    paidCount: number;
    payments: Array<{ paidAt: Date; dueDate: Date; amount: number; method?: string; note?: string }>;
    /** Last time the pre-send "heads-up" dialog listed this row (limits it to once a day). */
    headsUpAt?: Date;
    /** Channels the last reminder actually went out on. */
    lastChannels: string[];
    lastSentAt?: Date;
    sentCount: number;
    lastError?: string;
    /** Last time the decision dialog was shown to an admin (limits it to once a day). */
    lastPromptedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const paymentReminderSchema = new Schema<IPaymentReminder>(
    {
        kind: { type: String, enum: ['due', 'recurring'], required: true },
        orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
        receiptId: { type: Schema.Types.ObjectId, ref: 'Receipt' },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
        orderNumber: { type: String, required: true },
        clientName: { type: String, required: true },
        title: { type: String, required: true },
        amount: { type: Number, default: 0 },
        currency: { type: String, default: 'BDT' },
        cycle: { type: String, enum: ['monthly', 'yearly'] },
        status: {
            type: String,
            enum: ['awaiting_decision', 'scheduled', 'paused', 'cancelled', 'done'],
            default: 'awaiting_decision',
            index: true,
        },
        sendAt: { type: Date },
        dueDate: { type: Date },
        lastPaidAt: { type: Date },
        paidCount: { type: Number, default: 0 },
        payments: {
            type: [{ paidAt: Date, dueDate: Date, amount: Number, method: String, note: String, _id: false }],
            default: [],
        },
        lastSentAt: { type: Date },
        sentCount: { type: Number, default: 0 },
        lastError: { type: String },
        lastPromptedAt: { type: Date },
        headsUpAt: { type: Date },
        lastChannels: { type: [String], default: [] },
    },
    { timestamps: true },
);

// An order has at most one due row, and one recurring row per charge title.
paymentReminderSchema.index({ orderId: 1, kind: 1, title: 1 }, { unique: true });
paymentReminderSchema.index({ status: 1, sendAt: 1 });

const PaymentReminderModel = model<IPaymentReminder>('PaymentReminder', paymentReminderSchema);
export default PaymentReminderModel;
