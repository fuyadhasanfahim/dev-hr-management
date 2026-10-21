import type { Request, Response, NextFunction } from 'express';
import PaymentReminderService, { type ScheduleOption } from '../services/payment-reminder.service.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
};
const id = (req: Request) => String(req.params.id);

const list = wrap(async (req, res) => {
    const { kind, status } = req.query as Record<string, string | undefined>;
    res.json({ success: true, data: await PaymentReminderService.list({ ...(kind ? { kind } : {}), ...(status ? { status } : {}) }) });
});

const pending = wrap(async (_req, res) => {
    res.json({ success: true, data: await PaymentReminderService.pending() });
});

const prompted = wrap(async (req, res) => {
    await PaymentReminderService.markPrompted((req.body?.ids as string[]) || []);
    res.json({ success: true });
});

/** Body: { items: [{ id, option: 'instant'|'3d'|'7d'|'custom', date? }] } — also used for the dialog's close-to-default. */
const scheduleMany = wrap(async (req, res) => {
    const items = (req.body?.items || []) as Array<{ id: string; option: ScheduleOption; date?: string }>;
    for (const it of items) await PaymentReminderService.schedule(it.id, it.option, it.date);
    res.json({ success: true, message: 'Reminders scheduled' });
});

const reschedule = wrap(async (req, res) => {
    const { option, date } = req.body as { option: ScheduleOption; date?: string };
    res.json({ success: true, data: await PaymentReminderService.schedule(id(req), option, date) });
});

const action = wrap(async (req, res) => {
    const a = req.params.action as 'pause' | 'resume' | 'cancel' | 'send-now' | 'mark-paid';
    if (!['pause', 'resume', 'cancel', 'send-now', 'mark-paid'].includes(a)) {
        res.status(404).json({ success: false, message: 'Unknown action' });
        return;
    }
    res.json({ success: true, data: await PaymentReminderService.act(id(req), a, req.body || {}) });
});

const headsUp = wrap(async (_req, res) => {
    res.json({ success: true, data: await PaymentReminderService.headsUp() });
});

const headsUpSeen = wrap(async (req, res) => {
    await PaymentReminderService.markHeadsUpSeen((req.body?.ids as string[]) || []);
    res.json({ success: true });
});

const sync = wrap(async (_req, res) => {
    res.json({ success: true, data: { created: await PaymentReminderService.syncCompletedOrders() } });
});

export default { list, pending, prompted, headsUp, headsUpSeen, scheduleMany, reschedule, action, sync };
