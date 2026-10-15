import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import PhotoOrderService from '../services/photo-order.service.js';
import PhotoInvoiceModel from '../models/photo-invoice.model.js';
import emailService from '../services/email.service.js';
import { PHOTO_ORDER_PRIORITIES, PHOTO_ORDER_STATUSES } from '../models/photo-order.model.js';
import { AppError } from '../utils/AppError.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const num = (min = 0) => z.coerce.number().min(min);
const optionalInt = z.coerce.number().int().optional();

const orderBody = z.object({
    orderName: z.string().trim().min(1, 'Order name is required'),
    clientId: objectId,
    contactPersonId: objectId.optional().or(z.literal('').transform(() => undefined)),
    orderDate: z.coerce.date(),
    deadline: z.coerce.date(),
    imageQuantity: z.coerce.number().int().min(1, 'At least 1 image is required'),
    perImagePrice: num(),
    totalPrice: num(),
    services: z.array(objectId).min(1, 'Select at least one service'),
    returnFileFormat: objectId,
    instruction: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    priority: z.enum(PHOTO_ORDER_PRIORITIES).optional(),
});

const userId = (req: Request) => {
    const id = req.user?.id;
    if (!id) throw new AppError('Unauthorized', 401);
    return id;
};

/** Wraps a handler so a thrown error (zod, AppError, mongoose) reaches the error middleware. */
const h =
    (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req: Request, res: Response, next: NextFunction) =>
        fn(req, res).catch((err) => {
            if (err instanceof z.ZodError) {
                res.status(400).json({ success: false, message: 'Validation failed', errors: err.flatten().fieldErrors });
                return;
            }
            next(err);
        });

const ok = (res: Response, data: unknown, extra: Record<string, unknown> = {}, status = 200) =>
    void res.status(status).json({ success: true, data, ...extra });

// ── orders ──
const listOrders = h(async (req, res) => {
    const q = z
        .object({
            clientId: objectId.optional(),
            status: z.enum(PHOTO_ORDER_STATUSES).optional(),
            priority: z.enum(PHOTO_ORDER_PRIORITIES).optional(),
            month: optionalInt,
            year: optionalInt,
            search: z.string().trim().optional(),
            page: optionalInt,
            limit: optionalInt,
        })
        .parse(req.query);
    const { orders, ...meta } = await PhotoOrderService.listOrders(q);
    ok(res, orders, { meta });
});
const getOrder = h(async (req, res) => ok(res, await PhotoOrderService.getOrder(String(req.params.id))));
const createOrder = h(async (req, res) => ok(res, await PhotoOrderService.createOrder(orderBody.parse(req.body), userId(req)), {}, 201));
const updateOrder = h(async (req, res) => ok(res, await PhotoOrderService.updateOrder(String(req.params.id), orderBody.partial().parse(req.body))));
const deleteOrder = h(async (req, res) => {
    await PhotoOrderService.deleteOrder(String(req.params.id));
    ok(res, null);
});
const changeStatus = h(async (req, res) => {
    const b = z.object({ status: z.enum(PHOTO_ORDER_STATUSES), note: z.string().trim().optional() }).parse(req.body);
    ok(res, await PhotoOrderService.changeStatus(String(req.params.id), b.status, userId(req), b.note));
});
const extendDeadline = h(async (req, res) => {
    const b = z.object({ deadline: z.coerce.date(), reason: z.string().trim().optional() }).parse(req.body);
    ok(res, await PhotoOrderService.extendDeadline(String(req.params.id), b.deadline, b.reason, userId(req)));
});
const addRevision = h(async (req, res) => {
    const b = z.object({ instruction: z.string().trim().min(1, 'Revision instruction is required') }).parse(req.body);
    ok(res, await PhotoOrderService.addRevision(String(req.params.id), b.instruction, userId(req)));
});
const orderStats = h(async (_req, res) => ok(res, await PhotoOrderService.orderStats()));
const orderYears = h(async (_req, res) => ok(res, await PhotoOrderService.orderYears()));

// ── metadata ──
const metaQuery = z.object({
    search: z.string().trim().optional(),
    isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    page: optionalInt,
    limit: optionalInt,
});
const serviceBody = z.object({ name: z.string().trim().min(1, 'Name is required'), description: z.string().trim().optional(), price: num().optional() });
const formatBody = z.object({
    name: z.string().trim().min(1, 'Name is required'),
    extension: z.string().trim().min(1, 'Extension is required').transform((v) => v.replace(/^\./, '')),
    description: z.string().trim().optional(),
});

const listServices = h(async (req, res) => {
    const { items, ...meta } = await PhotoOrderService.listServices(metaQuery.parse(req.query));
    ok(res, items, { meta });
});
const createService = h(async (req, res) => ok(res, await PhotoOrderService.createService(serviceBody.parse(req.body), userId(req)), {}, 201));
const updateService = h(async (req, res) =>
    ok(res, await PhotoOrderService.updateService(String(req.params.id), serviceBody.partial().extend({ isActive: z.boolean().optional() }).parse(req.body))),
);
const deleteService = h(async (req, res) => {
    await PhotoOrderService.deleteService(String(req.params.id));
    ok(res, null);
});

const listFormats = h(async (req, res) => {
    const { items, ...meta } = await PhotoOrderService.listFormats(metaQuery.parse(req.query));
    ok(res, items, { meta });
});
const createFormat = h(async (req, res) => ok(res, await PhotoOrderService.createFormat(formatBody.parse(req.body), userId(req)), {}, 201));
const updateFormat = h(async (req, res) =>
    ok(res, await PhotoOrderService.updateFormat(String(req.params.id), formatBody.partial().extend({ isActive: z.boolean().optional() }).parse(req.body))),
);
const deleteFormat = h(async (req, res) => {
    await PhotoOrderService.deleteFormat(String(req.params.id));
    ok(res, null);
});

// ── invoices ──
const period = z.object({ month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2000).max(2100) });

const invoiceClients = h(async (req, res) => {
    const { month, year } = period.parse(req.query);
    ok(res, await PhotoOrderService.invoiceClients(month, year));
});
const invoiceOrders = h(async (req, res) => {
    const q = period.extend({ clientId: objectId }).parse(req.query);
    ok(res, await PhotoOrderService.invoiceOrders(q.clientId, q.month, q.year));
});
const createInvoice = h(async (req, res) => {
    const b = period.extend({ clientId: objectId, orderIds: z.array(objectId).min(1, 'Select at least one order'), dueDate: z.coerce.date().optional() }).parse(req.body);
    ok(res, await PhotoOrderService.createInvoice(b, userId(req)), {}, 201);
});
const listInvoices = h(async (req, res) => {
    const q = z
        .object({ clientId: objectId.optional(), month: optionalInt, year: optionalInt, status: z.enum(['pending', 'paid']).optional() })
        .parse(req.query);
    ok(res, await PhotoOrderService.listInvoices(q));
});
const getInvoice = h(async (req, res) => ok(res, await PhotoOrderService.getInvoice(String(req.params.id))));
const deleteInvoice = h(async (req, res) => {
    await PhotoOrderService.deleteInvoice(String(req.params.id));
    ok(res, null);
});

/** The invoice PDF is built in the browser from the invoice HTML and uploaded with this request. */
const emailInvoice = h(async (req, res) => {
    const pdf = req.file?.buffer;
    if (!pdf || pdf.subarray(0, 4).toString('latin1') !== '%PDF') throw new AppError('A valid PDF attachment is required', 400);
    const raw = req.body?.emails;
    const parsed: unknown = typeof raw === 'string' ? (raw.trim().startsWith('[') ? JSON.parse(raw) : raw.split(',')) : raw;
    const emails = z.array(z.string().trim().email()).min(1, 'Select at least one recipient').parse(parsed);

    const invoice = await PhotoOrderService.getInvoice(String(req.params.id));
    const doc = await PhotoInvoiceModel.findById(String(req.params.id)).lean();
    if (!doc) throw new AppError('Invoice not found', 404);
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: doc.currency });
    const clientName = (invoice.client as { name?: string } | null)?.name ?? 'Client';

    const results = await Promise.allSettled(
        emails.map((to) =>
            emailService.sendPhotoInvoiceEmail({
                to,
                clientName,
                invoiceNumber: doc.invoiceNumber,
                period: `${MONTHS[doc.month - 1]} ${doc.year}`,
                totalFormatted: fmt.format(doc.totalAmount),
                dueDate: doc.dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                ...(invoice.paymentUrl ? { payUrl: invoice.paymentUrl } : {}),
                attachment: { filename: `${doc.invoiceNumber}.pdf`, content: pdf },
            }),
        ),
    );
    const sent = emails.filter((_, i) => results[i]!.status === 'fulfilled');
    if (sent.length) await PhotoOrderService.markEmailed(String(req.params.id), sent);
    const recipients = emails.map((email, i) => ({ email, status: results[i]!.status === 'fulfilled' ? 'sent' : 'failed' }));
    if (!sent.length) {
        res.status(502).json({ success: false, message: 'Failed to send the invoice email', data: { recipients } });
        return;
    }
    ok(res, { recipients });
});

export default {
    listOrders, getOrder, createOrder, updateOrder, deleteOrder, changeStatus, extendDeadline, addRevision, orderStats, orderYears,
    listServices, createService, updateService, deleteService, listFormats, createFormat, updateFormat, deleteFormat,
    invoiceClients, invoiceOrders, createInvoice, listInvoices, getInvoice, deleteInvoice, emailInvoice,
};
