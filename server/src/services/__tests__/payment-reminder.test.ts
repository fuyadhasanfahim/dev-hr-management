/**
 * Integration test for the payment-reminder flow. Needs a THROWAWAY MongoDB:
 *   TEST_MONGO_URI=mongodb://.../some-temp-db node --import tsx --test src/services/__tests__/payment-reminder.test.ts
 * Skipped when TEST_MONGO_URI is unset. The database is dropped at the end. Email is stubbed.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const URI = process.env.TEST_MONGO_URI;
const skip = !URI;

process.env.PAYMENT_TOKEN_SECRET ||= 'test-secret-test-secret-test-secret';
process.env.PAYMENT_CLIENT_URL ||= 'https://pay.test';

const sent: any[] = [];
let mongoose: typeof import('mongoose').default;
let Svc: typeof import('../payment-reminder.service.js').default;
let Reminder: typeof import('../../models/payment-reminder.model.js').default;
let Order: typeof import('../../models/order.model.js').default;
let Notification: any;

const oid = () => new (mongoose.Types.ObjectId)();
const BD10 = (d: Date) => new Date(new Date(`${d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })}T10:00:00+06:00`));

async function seedOrder(opts: { status?: string; paid?: number; total?: number; emails?: string[]; recurring?: any[]; n: string }) {
    const clientId = oid();
    const groupId = `g-${opts.n}`;
    await mongoose.connection.collection('clients').insertOne({ _id: clientId, name: `Client ${opts.n}`, emails: opts.emails ?? [`c${opts.n}@x.test`] });
    const orderId = oid();
    await mongoose.connection.collection('orders').insertOne({
        _id: orderId,
        orderNumber: `ORD-${opts.n}`,
        quotationGroupId: groupId,
        clientId,
        status: opts.status ?? 'completed',
        totalPrice: opts.total ?? 100000,
        currency: 'BDT',
        quotationSnapshot: {
            clientName: `Client ${opts.n}`,
            currency: 'BDT',
            grandTotal: opts.total ?? 100000,
            services: [],
            recurringCharges: opts.recurring ?? [],
        },
    });
    await mongoose.connection.collection('receipts').insertOne({
        _id: oid(), receiptNumber: `RCPT-${opts.n}`, quotationGroupId: groupId, totalPaid: opts.paid ?? 40000, status: 'issued', currency: 'BDT',
    });
    return { orderId: String(orderId), clientId, groupId };
}

before(async () => {
    if (skip) return;
    mongoose = (await import('mongoose')).default;
    await mongoose.connect(URI!);
    const email = (await import('../email.service.js')).default as any;
    email.sendPaymentReminderEmail = async (d: unknown) => void sent.push(d);
    Svc = (await import('../payment-reminder.service.js')).default;
    Reminder = (await import('../../models/payment-reminder.model.js')).default;
    Order = (await import('../../models/order.model.js')).default;
    Notification = (await import('../../models/notification.model.js')).default;
    await mongoose.connection.collection('user').insertMany([
        { _id: oid(), name: 'A', email: 'a@x.test', role: 'admin' },
        { _id: oid(), name: 'B', email: 'b@x.test', role: 'super_admin' },
        { _id: oid(), name: 'S', email: 's@x.test', role: 'staff' },
    ]);
    await Reminder.syncIndexes();
});

after(async () => {
    if (skip) return;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    setImmediate(() => process.exit(0)); // redis/socket handles from imported services keep the loop alive
});

const find = (orderId: string, kind: string, title?: string) =>
    Reminder.findOne({ orderId, kind, ...(title ? { title } : {}) }).then((r) => r!);

test('creates due + recurring rows once, notifies admins only, skips bad charges', { skip }, async () => {
    const { orderId } = await seedOrder({
        n: '1',
        recurring: [
            { title: 'VPS', price: 10500, billingCycle: 'monthly' },
            { title: 'VPS', price: 500, billingCycle: 'monthly' }, // duplicate title
            { title: 'Domain', price: 5000, billingCycle: 'yearly' },
            { title: 'Free', price: 0, billingCycle: 'monthly' },
            { title: 'Odd', price: 100, billingCycle: 'per-image' },
        ],
    });
    assert.equal(await Svc.createForCompletedOrder(orderId), 4); // due + VPS + VPS (2) + Domain
    assert.equal(await Svc.createForCompletedOrder(orderId), 0); // idempotent
    const due = await find(orderId, 'due');
    assert.equal(due.amount, 60000);
    assert.equal(due.status, 'awaiting_decision');
    assert.ok(await find(orderId, 'recurring', 'VPS (2)'));
    assert.equal(await Notification.countDocuments({ type: 'payment' }), 8); // 4 rows × 2 admins
});

test('non-completed order creates nothing', { skip }, async () => {
    const { orderId } = await seedOrder({ n: '2', status: 'in_progress' });
    assert.equal(await Svc.createForCompletedOrder(orderId), 0);
});

test('pending shows once per day', { skip }, async () => {
    const before = await Svc.pending();
    assert.ok(before.length >= 4);
    await Svc.markPrompted(before.map((r) => String(r._id)));
    assert.equal((await Svc.pending()).length, 0);
});

test('instant due: emails with pay link, repeats weekly at 10:00 BD', { skip }, async () => {
    const { orderId } = await seedOrder({ n: '3', recurring: [] });
    await Svc.createForCompletedOrder(orderId);
    const due = await find(orderId, 'due');
    sent.length = 0;
    await Svc.schedule(String(due._id), 'instant');
    await Svc.processDueReminders();
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ['c3@x.test']);
    assert.match(sent[0].payUrl, /^https:\/\/pay\.test\/payment\//);
    assert.match(sent[0].amountFormatted, /60,000/);
    const after = await find(orderId, 'due');
    assert.equal(after.sentCount, 1);
    assert.equal(after.status, 'scheduled');
    const days = (after.sendAt!.getTime() - Date.now()) / 864e5;
    assert.ok(days > 6 && days < 8, `repeat in ~7d, got ${days}`);
    assert.equal(after.sendAt!.getTime(), BD10(after.sendAt!).getTime());
});

test('due fully paid before sending → done, no email', { skip }, async () => {
    const { orderId, groupId } = await seedOrder({ n: '4' });
    await Svc.createForCompletedOrder(orderId);
    const due = await find(orderId, 'due');
    await mongoose.connection.collection('receipts').updateOne({ quotationGroupId: groupId }, { $set: { totalPaid: 100000 } });
    sent.length = 0;
    await Svc.schedule(String(due._id), 'instant');
    await Svc.processDueReminders();
    assert.equal(sent.length, 0);
    assert.equal((await find(orderId, 'due')).status, 'done');
});

test('cancelled order → reminder cancelled, nothing sent', { skip }, async () => {
    const { orderId } = await seedOrder({ n: '5' });
    await Svc.createForCompletedOrder(orderId);
    await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(orderId) }, { $set: { status: 'cancelled' } });
    sent.length = 0;
    await Svc.schedule(String((await find(orderId, 'due'))._id), 'instant');
    await Svc.processDueReminders();
    assert.equal(sent.length, 0);
    assert.equal((await find(orderId, 'due')).status, 'cancelled');
});

test('order reopened (revision) → deferred a day, nothing sent', { skip }, async () => {
    const { orderId } = await seedOrder({ n: '6' });
    await Svc.createForCompletedOrder(orderId);
    await Order.collection.updateOne({ _id: new mongoose.Types.ObjectId(orderId) }, { $set: { status: 'revision' } });
    sent.length = 0;
    await Svc.schedule(String((await find(orderId, 'due'))._id), 'instant');
    await Svc.processDueReminders();
    assert.equal(sent.length, 0);
    const r = await find(orderId, 'due');
    assert.equal(r.status, 'scheduled');
    assert.ok(r.sendAt!.getTime() > Date.now() + 20 * 36e5);
});

test('client without email → error recorded, stays scheduled, no crash', { skip }, async () => {
    const { orderId } = await seedOrder({ n: '7', emails: [] });
    await Svc.createForCompletedOrder(orderId);
    await Svc.schedule(String((await find(orderId, 'due'))._id), 'instant');
    await Svc.processDueReminders();
    const r = await find(orderId, 'due');
    assert.match(r.lastError!, /no email/i);
    assert.equal(r.status, 'scheduled');
    assert.equal(r.sentCount, 0);
});

test('pause blocks sending; resume of a past date reschedules to the future', { skip }, async () => {
    const { orderId } = await seedOrder({ n: '8' });
    await Svc.createForCompletedOrder(orderId);
    const id = String((await find(orderId, 'due'))._id);
    await Svc.schedule(id, '3d');
    await Svc.act(id, 'pause');
    await Reminder.updateOne({ _id: id }, { $set: { sendAt: new Date(Date.now() - 1000) } });
    sent.length = 0;
    await Svc.processDueReminders();
    assert.equal(sent.length, 0);
    await Svc.act(id, 'resume');
    assert.ok((await Reminder.findById(id))!.sendAt!.getTime() > Date.now());
});

test('past date rejected; two parallel runs send once', { skip }, async () => {
    const { orderId } = await seedOrder({ n: '9' });
    await Svc.createForCompletedOrder(orderId);
    const id = String((await find(orderId, 'due'))._id);
    await assert.rejects(Svc.schedule(id, 'custom', '2020-01-01'), /past/i);
    await assert.rejects(Svc.schedule(id, 'custom'), /date/i);
    sent.length = 0;
    await Svc.schedule(id, 'instant');
    await Promise.all([Svc.processDueReminders(), Svc.processDueReminders()]);
    assert.equal(sent.length, 1);
});

test('recurring: reminder repeats until marked paid, then moves one cycle', { skip }, async () => {
    const { orderId } = await seedOrder({ n: '10', recurring: [{ title: 'VPS', price: 10500, billingCycle: 'monthly' }] });
    await Svc.createForCompletedOrder(orderId);
    const rec = await find(orderId, 'recurring', 'VPS');
    const id = String(rec._id);
    sent.length = 0;
    await Svc.schedule(id, 'instant');
    await Svc.processDueReminders();
    let r = (await Reminder.findById(id))!;
    assert.equal(sent.length, 1);
    assert.equal(sent[0].payUrl, undefined);
    assert.ok(r.dueDate, 'dueDate set on first schedule');
    assert.ok(r.sendAt!.getTime() < Date.now() + 8 * 864e5, 'still nags weekly, not next month');
    const firstDue = r.dueDate!;
    await Svc.act(id, 'mark-paid');
    r = (await Reminder.findById(id))!;
    assert.equal(r.paidCount, 1);
    assert.equal(r.payments.length, 1);
    assert.equal(r.payments[0]!.amount, 10500);
    assert.equal(r.dueDate!.getMonth(), (firstDue.getMonth() + 1) % 12);
    assert.equal(r.sendAt!.getTime(), BD10(r.dueDate!).getTime());
    await assert.rejects(Svc.act(String((await find(orderId, 'due'))._id), 'mark-paid'), /recurring/i);
});

test('month-end clamp: Jan 31 + 1 month = Feb 28', { skip }, async () => {
    const { orderId } = await seedOrder({ n: '11', recurring: [{ title: 'X', price: 100, billingCycle: 'monthly' }] });
    await Svc.createForCompletedOrder(orderId);
    const id = String((await find(orderId, 'recurring', 'X'))._id);
    await Svc.schedule(id, '7d');
    await Reminder.updateOne({ _id: id }, { $set: { dueDate: new Date(2025, 0, 31, 12) } });
    await Svc.act(id, 'mark-paid');
    const d = (await Reminder.findById(id))!.dueDate!;
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2025, 1, 28]);
});

test('send-now leaves the schedule alone; sync backfills without duplicates', { skip }, async () => {
    const { orderId } = await seedOrder({ n: '12' });
    await Svc.createForCompletedOrder(orderId, false);
    const id = String((await find(orderId, 'due'))._id);
    await Svc.schedule(id, '7d');
    const at = (await Reminder.findById(id))!.sendAt!.getTime();
    sent.length = 0;
    await Svc.act(id, 'send-now');
    assert.equal(sent.length, 1);
    assert.equal((await Reminder.findById(id))!.sendAt!.getTime(), at);
    assert.equal(await Svc.syncCompletedOrders(), 0);
});
