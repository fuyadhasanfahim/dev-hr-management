import { Types } from 'mongoose';
import PaymentReminderModel, { type IPaymentReminder } from '../models/payment-reminder.model.js';
import OrderModel from '../models/order.model.js';
import ReceiptModel from '../models/receipt.model.js';
import ClientModel from '../models/client.model.js';
import UserModel from '../models/user.model.js';
import { OrderStatus } from '../models/order.model.js';
import { AppError } from '../utils/AppError.js';
import { getBDStartOfDay } from '../utils/date.util.js';
import { attachReceiptLedger } from './invoice-puppeteer-pdf.service.js';
import { PaymentService, resolveOrderTotals } from './payment.service.js';
import notificationService from './notification.service.js';
import emailService from './email.service.js';
import whatsappService from './whatsapp.service.js';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import { toWhatsAppNumber } from '../utils/phone.util.js';

const DAY = 24 * 60 * 60 * 1000;
const SEND_HOUR_MS = 10 * 60 * 60 * 1000; // reminders go out at 10:00 Bangladesh time
const DUE_REPEAT_DAYS = 7; // unpaid balance is re-reminded weekly
const RETRY_MS = 60 * 60 * 1000;
const EPS = 0.009;

export type ScheduleOption = 'instant' | '3d' | '7d' | 'custom';

/** 10:00 Dhaka on the given day. */
const atSendHour = (d: Date) => new Date(getBDStartOfDay(d).getTime() + SEND_HOUR_MS);

function resolveSendAt(option: ScheduleOption, date?: string | Date): Date {
    const now = new Date();
    if (option === 'instant') return now;
    if (option === '3d') return atSendHour(new Date(now.getTime() + 3 * DAY));
    if (option === '7d') return atSendHour(new Date(now.getTime() + 7 * DAY));
    const d = date ? new Date(date) : null;
    if (!d || Number.isNaN(d.getTime())) throw new AppError('A valid date is required', 400);
    const at = atSendHour(d);
    if (at.getTime() < getBDStartOfDay(now).getTime()) throw new AppError('Date cannot be in the past', 400);
    return at.getTime() < now.getTime() ? now : at; // today after 10:00 → send on next tick
}

/** One cycle later, clamping the day so Jan 31 + 1 month is Feb 28/29 (not Mar 3). */
function addCycle(d: Date, cycle: 'monthly' | 'yearly'): Date {
    const n = new Date(d);
    const day = n.getDate();
    n.setDate(1);
    if (cycle === 'yearly') n.setFullYear(n.getFullYear() + 1);
    else n.setMonth(n.getMonth() + 1);
    n.setDate(Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()));
    return n;
}

async function getOrderDue(order: Record<string, any>) {
    const { grandTotal, currency } = resolveOrderTotals(order);
    const { balanceDue } = await attachReceiptLedger(order.quotationGroupId, grandTotal);
    return { balanceDue: Math.max(0, balanceDue), currency };
}

async function adminUserIds(): Promise<string[]> {
    const admins = await UserModel.find({ role: { $in: ['super_admin', 'admin'] } }, { projection: { _id: 1 } }).toArray();
    return admins.map((u) => String(u._id));
}

/** Creates the due / recurring rows for a completed order (idempotent) and alerts admins. */
async function createForCompletedOrder(orderId: string, notify = true): Promise<number> {
    const order = await OrderModel.findById(orderId).lean();
    if (!order || order.status !== OrderStatus.COMPLETED) return 0;

    const snap: any = order.quotationSnapshot || {};
    const { balanceDue, currency } = await getOrderDue(order);
    const receipt = await ReceiptModel.findOne({ quotationGroupId: order.quotationGroupId }).select('_id').lean();
    const base = {
        orderId: order._id,
        clientId: order.clientId,
        orderNumber: order.orderNumber,
        clientName: snap.clientName || 'Client',
        currency,
        status: 'awaiting_decision' as const,
        ...(receipt ? { receiptId: receipt._id } : {}),
    };

    const rows: Array<{ filter: Record<string, unknown>; insert: Record<string, unknown> }> = [];
    if (balanceDue > EPS) {
        rows.push({
            filter: { orderId: order._id, kind: 'due', title: 'Due payment' },
            insert: { ...base, amount: balanceDue },
        });
    }
    const seen = new Set<string>();
    for (const rc of snap.recurringCharges || []) {
        if (rc.billingCycle !== 'monthly' && rc.billingCycle !== 'yearly') continue;
        if (!(Number(rc.price) > 0)) continue;
        let title: string = rc.title || 'Recurring charge';
        for (let n = 2; seen.has(title); n++) title = `${rc.title} (${n})`; // unique per order
        seen.add(title);
        rows.push({
            filter: { orderId: order._id, kind: 'recurring', title },
            insert: { ...base, title, amount: rc.price, cycle: rc.billingCycle },
        });
    }

    let created = 0;
    for (const r of rows) {
        const res = await PaymentReminderModel.updateOne(r.filter, { $setOnInsert: r.insert }, { upsert: true });
        if (res.upsertedCount) {
            created++;
            if (notify) await notifyAdmins(r.insert as any, r.filter.kind as string);
        }
    }
    return created;
}

async function notifyAdmins(row: { orderNumber: string; clientName: string; amount: number; currency: string; receiptId?: Types.ObjectId; cycle?: string }, kind: string) {
    const money = `${row.currency} ${row.amount.toLocaleString()}`;
    const isDue = kind === 'due';
    const payload = {
        title: isDue ? `Due payment: ${row.clientName}` : `Recurring payment: ${row.clientName}`,
        message: isDue
            ? `Order ${row.orderNumber} is complete. ${money} is still due — set when to remind the client.`
            : `Order ${row.orderNumber} is complete. ${money}/${row.cycle === 'yearly' ? 'year' : 'month'} recurring — set when to remind the client.`,
        type: 'payment' as const,
        priority: 'high' as const,
        actionUrl: isDue && row.receiptId ? `/receipts/${row.receiptId}` : '/payment-reminders?tab=recurring',
        actionLabel: isDue ? 'Open receipt' : 'Open reminders',
    };
    for (const userId of await adminUserIds()) {
        await notificationService.createNotification({ userId, ...payload }).catch((e: unknown) => logger.error({ e }, 'payment_reminder.notify_failed'));
    }
}

export { toWhatsAppNumber };

/**
 * Sends the reminder now on every channel that is available: email (client's addresses) and
 * WhatsApp (client's phone, only when an approved template is configured). Succeeds if at least
 * one channel did; throws only when none could. Does not touch the schedule.
 */
async function deliver(r: IPaymentReminder): Promise<{ amount: number; paid: boolean; channels: string[]; warning?: string }> {
    const order = await OrderModel.findById(r.orderId).lean();
    if (!order) throw new AppError('Order not found', 404);

    let amount = r.amount;
    let payUrl: string | undefined;
    if (r.kind === 'due') {
        amount = (await getOrderDue(order)).balanceDue;
        if (amount <= EPS) return { amount: 0, paid: true, channels: [] };
        const issued = await PaymentService.issueTokenForOrder(String(r.orderId));
        const portal = envConfig.payment_client_url.replace(/\/+$/, '');
        if (issued && portal) payUrl = `${portal}/payment/${encodeURIComponent(issued.token)}`;
    }
    const amountFormatted = `${r.currency} ${amount.toLocaleString()}`;

    const client: any = await ClientModel.findById(r.clientId).select('emails phone').lean();
    const to: string[] = client?.emails?.filter(Boolean) ?? [];
    const channels: string[] = [];
    const problems: string[] = [];

    if (to.length) {
        try {
            await emailService.sendPaymentReminderEmail({
                to,
                clientName: r.clientName,
                orderNumber: r.orderNumber,
                kind: r.kind,
                title: r.title,
                amountFormatted,
                ...(r.cycle ? { cycle: r.cycle } : {}),
                ...(payUrl ? { payUrl } : {}),
            });
            channels.push('email');
        } catch (e: any) {
            problems.push(`Email: ${e?.message || 'failed'}`);
        }
    } else {
        problems.push('Email: client has no email address');
    }

    const template = r.kind === 'due' ? envConfig.wa_template_payment_due : envConfig.wa_template_payment_recurring;
    const phone = toWhatsAppNumber(client?.phone);
    if (template && phone) {
        // Template bodies: due → {{1}} name {{2}} amount {{3}} order {{4}} pay link
        //                  recurring → {{1}} name {{2}} cycle {{3}} charge {{4}} amount {{5}} order
        const params =
            r.kind === 'due'
                ? [r.clientName, amountFormatted, r.orderNumber, payUrl || 'please contact us']
                : [r.clientName, r.cycle === 'yearly' ? 'yearly' : 'monthly', r.title, amountFormatted, r.orderNumber];
        try {
            await whatsappService.sendTemplateMessage(phone, template, envConfig.wa_template_language, params);
            channels.push('whatsapp');
        } catch (e: any) {
            problems.push(`WhatsApp: ${e?.message || 'failed'}`);
        }
    }

    if (!channels.length) throw new AppError(problems.join(' · ') || 'No channel available', 422);
    return { amount, paid: false, channels, ...(problems.length ? { warning: problems.join(' · ') } : {}) };
}

/** Cron entry: claims every due reminder (lease-style, so overlapping ticks can't double-send) and emails it. */
let inflight: Promise<void> | null = null;
function processDueReminders(): Promise<void> {
    inflight ??= runDueReminders().finally(() => {
        inflight = null;
    });
    return inflight;
}

async function runDueReminders(): Promise<void> {
    {
        for (;;) {
            const doc = await PaymentReminderModel.findOneAndUpdate(
                { status: 'scheduled', sendAt: { $lte: new Date() } },
                { $set: { sendAt: new Date(Date.now() + RETRY_MS) } }, // lease; overwritten on success
                { sort: { sendAt: 1 }, new: false },
            );
            if (!doc) break;
            try {
                const order = await OrderModel.findById(doc.orderId).select('status').lean();
                if (!order || order.status === OrderStatus.CANCELLED) {
                    await PaymentReminderModel.updateOne({ _id: doc._id }, { $set: { status: 'cancelled' } });
                    continue;
                }
                if (order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.DELIVERED) {
                    // Reopened (e.g. revision): don't nag the client mid-work, look again tomorrow.
                    await PaymentReminderModel.updateOne({ _id: doc._id }, { $set: { sendAt: new Date(Date.now() + DAY) } });
                    continue;
                }
                const { amount, paid, channels, warning } = await deliver(doc);
                if (paid) {
                    await PaymentReminderModel.updateOne({ _id: doc._id }, { $set: { status: 'done' } });
                    continue;
                }
                // Unpaid stays unpaid: both kinds re-remind weekly until paid (due → balance 0,
                // recurring → admin marks the cycle paid, which moves it to the next cycle).
                const next = atSendHour(new Date(Date.now() + DUE_REPEAT_DAYS * DAY));
                await PaymentReminderModel.updateOne(
                    { _id: doc._id },
                    {
                        $set: { sendAt: next, amount, lastSentAt: new Date(), lastChannels: channels, ...(warning ? { lastError: warning } : {}) },
                        ...(warning ? {} : { $unset: { lastError: '' } }),
                        $inc: { sentCount: 1 },
                    },
                );
            } catch (err: any) {
                logger.error({ err, id: String(doc._id) }, 'payment_reminder.send_failed');
                await PaymentReminderModel.updateOne({ _id: doc._id }, { $set: { lastError: err?.message || 'send failed' } });
            }
        }
    }
}

async function list(filter: { kind?: string; status?: string }) {
    const q: Record<string, unknown> = {};
    if (filter.kind) q.kind = filter.kind;
    if (filter.status) q.status = filter.status;
    const rows = await PaymentReminderModel.find(q).sort({ sendAt: 1, createdAt: -1 }).lean();
    // Keep due amounts live; settle rows whose balance has since been paid.
    for (const r of rows) {
        if (r.kind !== 'due' || r.status === 'done' || r.status === 'cancelled') continue;
        const order = await OrderModel.findById(r.orderId).lean();
        if (!order) continue;
        const { balanceDue } = await getOrderDue(order);
        if (balanceDue <= EPS) {
            await PaymentReminderModel.updateOne({ _id: r._id }, { $set: { status: 'done' } });
            r.status = 'done';
        }
        r.amount = balanceDue;
    }
    return rows;
}

/** Rows the admin still has to decide on and has not been asked about today. */
async function pending() {
    return PaymentReminderModel.find({
        status: 'awaiting_decision',
        $or: [{ lastPromptedAt: { $exists: false } }, { lastPromptedAt: { $lt: getBDStartOfDay() } }],
    })
        .sort({ createdAt: 1 })
        .lean();
}

/** Reminders going out within ~a day that the admin has not been warned about today — a last chance to catch a payment nobody recorded. */
async function headsUp() {
    const now = new Date();
    return PaymentReminderModel.find({
        status: 'scheduled',
        sendAt: { $gt: now, $lte: new Date(now.getTime() + 30 * 60 * 60 * 1000) },
        $or: [{ headsUpAt: { $exists: false } }, { headsUpAt: { $lt: getBDStartOfDay() } }],
    })
        .sort({ sendAt: 1 })
        .lean();
}

async function markHeadsUpSeen(ids: string[]) {
    await PaymentReminderModel.updateMany({ _id: { $in: ids } }, { $set: { headsUpAt: new Date() } });
}

async function markPrompted(ids: string[]) {
    await PaymentReminderModel.updateMany({ _id: { $in: ids }, status: 'awaiting_decision' }, { $set: { lastPromptedAt: new Date() } });
}

async function schedule(id: string, option: ScheduleOption, date?: string) {
    const sendAt = resolveSendAt(option, date);
    const doc = await PaymentReminderModel.findOne({ _id: id, status: { $ne: 'done' } });
    if (!doc) throw new AppError('Reminder not found', 404);
    doc.status = 'scheduled';
    doc.sendAt = sendAt;
    doc.lastError = undefined as unknown as string;
    if (doc.kind === 'recurring' && !doc.dueDate) doc.dueDate = sendAt; // first date chosen = first cycle due
    await doc.save();
    if (option === 'instant') void processDueReminders();
    return doc;
}

export interface PaidDetails {
    amount?: number;
    paidAt?: string;
    method?: string;
    note?: string;
}

async function act(id: string, action: 'pause' | 'resume' | 'cancel' | 'send-now' | 'mark-paid', paid: PaidDetails = {}) {
    const doc = await PaymentReminderModel.findById(id);
    if (!doc || doc.status === 'done') throw new AppError('Reminder not found', 404);
    if (action === 'mark-paid') {
        // Recurring only: due balances are settled through the receipt ledger instead.
        if (doc.kind !== 'recurring' || !doc.cycle || !doc.dueDate) {
            throw new AppError('Only a scheduled recurring charge can be marked paid', 409);
        }
        const amount = paid.amount === undefined ? doc.amount : Number(paid.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Enter a valid amount', 400);
        const paidAt = paid.paidAt ? new Date(paid.paidAt) : new Date();
        if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + DAY) throw new AppError('Enter a valid payment date', 400);
        doc.payments.push({
            paidAt,
            dueDate: doc.dueDate,
            amount,
            ...(paid.method ? { method: paid.method } : {}),
            ...(paid.note ? { note: paid.note } : {}),
        });
        doc.paidCount += 1;
        doc.lastPaidAt = paidAt;
        doc.dueDate = addCycle(doc.dueDate, doc.cycle);
        if (doc.status === 'scheduled') doc.sendAt = atSendHour(doc.dueDate); // next cycle's reminder
    } else if (action === 'send-now') {
        const { paid, channels } = await deliver(doc);
        if (paid) doc.status = 'done';
        else {
            doc.lastSentAt = new Date();
            doc.sentCount += 1;
            doc.lastChannels = channels;
        }
    } else if (action === 'pause') {
        if (doc.status !== 'scheduled') throw new AppError('Only scheduled reminders can be paused', 409);
        doc.status = 'paused';
    } else if (action === 'resume') {
        if (doc.status !== 'paused' && doc.status !== 'cancelled') throw new AppError('Nothing to resume', 409);
        doc.status = 'scheduled';
        if (!doc.sendAt || doc.sendAt.getTime() < Date.now()) doc.sendAt = atSendHour(new Date(Date.now() + DAY));
    } else {
        doc.status = 'cancelled';
    }
    await doc.save();
    return doc;
}

/** Backfill for orders completed before this feature existed. */
async function syncCompletedOrders(): Promise<number> {
    const orders = await OrderModel.find({ status: OrderStatus.COMPLETED }).select('_id').lean();
    let created = 0;
    for (const o of orders) created += await createForCompletedOrder(String(o._id), false);
    return created;
}

export default { createForCompletedOrder, processDueReminders, list, pending, markPrompted, headsUp, markHeadsUpSeen, schedule, act, syncCompletedOrders };
