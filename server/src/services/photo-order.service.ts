import mongoose from 'mongoose';
import PhotoOrderModel, { type IPhotoOrder, type PhotoOrderStatus, type PhotoOrderPriority } from '../models/photo-order.model.js';
import PhotoServiceModel from '../models/photo-service.model.js';
import PhotoReturnFormatModel from '../models/photo-return-format.model.js';
import PhotoInvoiceModel, { type IPhotoInvoice } from '../models/photo-invoice.model.js';
import { PhotoInvoiceCounter } from '../models/photo-invoice-counter.model.js';
import PaymentTokenModel from '../models/payment-token.model.js';
import ClientModel from '../models/client.model.js';
import { PaymentService } from './payment.service.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../lib/sanitize.js';
import envConfig from '../config/env.config.js';

const oid = (id: string) => new mongoose.Types.ObjectId(id);

// ───────────────────────── orders ─────────────────────────

/** Which statuses an order may move to from its current one. */
const STATUS_WORKFLOW: Record<PhotoOrderStatus, PhotoOrderStatus[]> = {
    pending: ['in_progress', 'cancelled'],
    in_progress: ['quality_check', 'revision', 'cancelled'],
    quality_check: ['ready_to_deliver', 'revision', 'in_progress'],
    revision: ['in_progress', 'cancelled'],
    ready_to_deliver: ['completed', 'revision'],
    completed: ['delivered', 'revision'],
    delivered: [],
    cancelled: [],
};

export interface OrderInput {
    orderName: string;
    clientId: string;
    contactPersonId?: string;
    orderDate: Date;
    deadline: Date;
    imageQuantity: number;
    perImagePrice: number;
    totalPrice: number;
    services: string[];
    returnFileFormat: string;
    instruction?: string;
    notes?: string;
    priority?: PhotoOrderPriority;
}

export interface OrderFilters {
    clientId?: string;
    status?: PhotoOrderStatus;
    priority?: PhotoOrderPriority;
    month?: number;
    year?: number;
    search?: string;
    page?: number;
    limit?: number;
}

const populateOrder = [
    { path: 'clientId', select: 'name clientId emails currency teamMembers' },
    { path: 'services', select: 'name price' },
    { path: 'returnFileFormat', select: 'name extension' },
];

const monthRange = (year: number, month?: number) =>
    month
        ? { $gte: new Date(year, month - 1, 1), $lte: new Date(year, month, 0, 23, 59, 59, 999) }
        : { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31, 23, 59, 59, 999) };

async function listOrders(f: OrderFilters) {
    const page = Math.max(1, f.page ?? 1);
    const limit = Math.min(1000, Math.max(1, f.limit ?? 10));
    const q: Record<string, unknown> = {};
    if (f.clientId) q.clientId = oid(f.clientId);
    if (f.status) q.status = f.status;
    if (f.priority) q.priority = f.priority;
    if (f.month || f.year) q.orderDate = monthRange(f.year ?? new Date().getFullYear(), f.month);
    if (f.search) {
        const rx = { $regex: escapeRegex(f.search), $options: 'i' };
        const clients = await ClientModel.find({ $or: [{ name: rx }, { clientId: rx }] }).select('_id').lean();
        q.$or = [{ orderName: rx }, { clientId: { $in: clients.map((c) => c._id) } }];
    }
    const [orders, total] = await Promise.all([
        PhotoOrderModel.find(q).sort({ orderDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate(populateOrder).lean(),
        PhotoOrderModel.countDocuments(q),
    ]);
    return { orders, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function getOrder(id: string) {
    const order = await PhotoOrderModel.findById(id).populate(populateOrder).lean();
    if (!order) throw new AppError('Order not found', 404);
    return order;
}

async function assertRefs(data: Pick<OrderInput, 'clientId' | 'services' | 'returnFileFormat'>) {
    const [client, formatOk, serviceCount] = await Promise.all([
        ClientModel.exists({ _id: data.clientId }),
        PhotoReturnFormatModel.exists({ _id: data.returnFileFormat }),
        PhotoServiceModel.countDocuments({ _id: { $in: data.services } }),
    ]);
    if (!client) throw new AppError('Client not found', 404);
    if (!formatOk) throw new AppError('Return file format not found', 404);
    if (serviceCount !== new Set(data.services).size) throw new AppError('One or more services were not found', 404);
}

async function createOrder(data: OrderInput, userId: string) {
    await assertRefs(data);
    const order = (await PhotoOrderModel.create({
        ...data,
        originalDeadline: data.deadline,
        createdBy: userId,
        timeline: [{ status: 'pending', timestamp: new Date(), changedBy: userId, note: 'Order created' }],
    } as never)) as unknown as IPhotoOrder;
    return getOrder(String(order._id));
}

async function updateOrder(id: string, data: Partial<OrderInput>) {
    const order = await PhotoOrderModel.findById(id);
    if (!order) throw new AppError('Order not found', 404);
    if (order.invoiceId) throw new AppError(`This order is on invoice ${order.invoiceNumber}; delete the invoice before editing it.`, 409);
    await assertRefs({
        clientId: data.clientId ?? String(order.clientId),
        services: data.services ?? order.services.map(String),
        returnFileFormat: data.returnFileFormat ?? String(order.returnFileFormat),
    });
    order.set(data);
    await order.save();
    return getOrder(id);
}

async function deleteOrder(id: string) {
    const order = await PhotoOrderModel.findById(id);
    if (!order) throw new AppError('Order not found', 404);
    if (order.invoiceId) throw new AppError(`This order is on invoice ${order.invoiceNumber}; delete the invoice first.`, 409);
    await order.deleteOne();
}

async function changeStatus(id: string, status: PhotoOrderStatus, userId: string, note?: string) {
    const order = await PhotoOrderModel.findById(id);
    if (!order) throw new AppError('Order not found', 404);
    if (status === 'cancelled' && order.invoiceId) {
        throw new AppError(`This order is on invoice ${order.invoiceNumber}; delete the invoice before cancelling it.`, 409);
    }
    if (!STATUS_WORKFLOW[order.status].includes(status)) {
        throw new AppError(`An order that is ${order.status.replace(/_/g, ' ')} cannot move to ${status.replace(/_/g, ' ')}`, 400);
    }
    order.status = status;
    if (status === 'completed') order.completedAt = new Date();
    if (status === 'delivered') order.deliveredAt = new Date();
    order.timeline.push({ status, timestamp: new Date(), changedBy: new mongoose.Types.ObjectId(userId), ...(note ? { note } : {}) });
    await order.save();
    return getOrder(id);
}

async function extendDeadline(id: string, deadline: Date, reason: string | undefined, userId: string) {
    const order = await PhotoOrderModel.findById(id);
    if (!order) throw new AppError('Order not found', 404);
    if (deadline <= order.deadline) throw new AppError('The new deadline must be later than the current one', 400);
    if (!order.originalDeadline) order.originalDeadline = order.deadline;
    order.deadline = deadline;
    order.timeline.push({
        status: order.status,
        timestamp: new Date(),
        changedBy: new mongoose.Types.ObjectId(userId),
        note: `Deadline extended${reason ? `: ${reason}` : ''}`,
    });
    await order.save();
    return getOrder(id);
}

async function addRevision(id: string, instruction: string, userId: string) {
    const order = await PhotoOrderModel.findById(id);
    if (!order) throw new AppError('Order not found', 404);
    if (!STATUS_WORKFLOW[order.status].includes('revision')) {
        throw new AppError(`A revision cannot be requested while the order is ${order.status.replace(/_/g, ' ')}`, 400);
    }
    order.status = 'revision';
    order.revisionCount += 1;
    order.revisionInstructions.push({ instruction, createdAt: new Date(), createdBy: new mongoose.Types.ObjectId(userId) });
    order.timeline.push({ status: 'revision', timestamp: new Date(), changedBy: new mongoose.Types.ObjectId(userId), note: instruction });
    await order.save();
    return getOrder(id);
}

async function orderStats() {
    const rows = await PhotoOrderModel.aggregate<{ _id: PhotoOrderStatus; count: number; images: number }>([
        { $group: { _id: '$status', count: { $sum: 1 }, images: { $sum: '$imageQuantity' } } },
    ]);
    const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    return { total: rows.reduce((a, r) => a + r.count, 0), totalImages: rows.reduce((a, r) => a + r.images, 0), byStatus };
}

async function orderYears(): Promise<number[]> {
    const rows = await PhotoOrderModel.aggregate<{ _id: number }>([{ $group: { _id: { $year: '$orderDate' } } }, { $sort: { _id: -1 } }]);
    return rows.map((r) => r._id);
}

// ───────────────────── metadata: services + return formats ─────────────────────

interface MetaFilters {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

async function listMeta(model: typeof PhotoServiceModel | typeof PhotoReturnFormatModel, f: MetaFilters) {
    const page = Math.max(1, f.page ?? 1);
    const limit = Math.min(1000, Math.max(1, f.limit ?? 20));
    const q: Record<string, unknown> = {};
    if (f.isActive !== undefined) q.isActive = f.isActive;
    if (f.search) q.name = { $regex: escapeRegex(f.search), $options: 'i' };
    const [items, total] = await Promise.all([
        (model as typeof PhotoServiceModel).find(q).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
        (model as typeof PhotoServiceModel).countDocuments(q),
    ]);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

const duplicate = (err: unknown, what: string): never => {
    if ((err as { code?: number })?.code === 11000) throw new AppError(`A ${what} with this name already exists`, 409);
    throw err;
};

const listServices = (f: MetaFilters) => listMeta(PhotoServiceModel, f);
const createService = async (d: { name: string; description?: string; price?: number }, userId: string) =>
    PhotoServiceModel.create({ ...d, createdBy: userId }).catch((e) => duplicate(e, 'service'));
const updateService = async (id: string, d: { name?: string; description?: string; price?: number; isActive?: boolean }) => {
    const doc = await PhotoServiceModel.findByIdAndUpdate(id, d, { new: true, runValidators: true }).catch((e) => duplicate(e, 'service'));
    if (!doc) throw new AppError('Service not found', 404);
    return doc;
};
async function deleteService(id: string) {
    const used = await PhotoOrderModel.countDocuments({ services: id });
    if (used) throw new AppError(`This service is used by ${used} order${used === 1 ? '' : 's'}. Deactivate it instead.`, 409);
    if (!(await PhotoServiceModel.findByIdAndDelete(id))) throw new AppError('Service not found', 404);
}

const listFormats = (f: MetaFilters) => listMeta(PhotoReturnFormatModel, f);
const createFormat = async (d: { name: string; extension: string; description?: string }, userId: string) =>
    PhotoReturnFormatModel.create({ ...d, createdBy: userId }).catch((e) => duplicate(e, 'file format'));
const updateFormat = async (id: string, d: { name?: string; extension?: string; description?: string; isActive?: boolean }) => {
    const doc = await PhotoReturnFormatModel.findByIdAndUpdate(id, d, { new: true, runValidators: true }).catch((e) => duplicate(e, 'file format'));
    if (!doc) throw new AppError('File format not found', 404);
    return doc;
};
async function deleteFormat(id: string) {
    const used = await PhotoOrderModel.countDocuments({ returnFileFormat: id });
    if (used) throw new AppError(`This format is used by ${used} order${used === 1 ? '' : 's'}. Deactivate it instead.`, 409);
    if (!(await PhotoReturnFormatModel.findByIdAndDelete(id))) throw new AppError('File format not found', 404);
}

// ───────────────────────── invoices ─────────────────────────

const INVOICE_DUE_DAYS = 15;

/** Clients that have at least one (non-cancelled) order in the month, with how many are still un-invoiced. */
async function invoiceClients(month: number, year: number) {
    const rows = await PhotoOrderModel.aggregate<{ _id: mongoose.Types.ObjectId; orders: number; uninvoiced: number; images: number }>([
        { $match: { orderDate: monthRange(year, month), status: { $ne: 'cancelled' } } },
        {
            $group: {
                _id: '$clientId',
                orders: { $sum: 1 },
                uninvoiced: { $sum: { $cond: [{ $ifNull: ['$invoiceId', false] }, 0, 1] } },
                images: { $sum: '$imageQuantity' },
            },
        },
    ]);
    const clients = await ClientModel.find({ _id: { $in: rows.map((r) => r._id) } })
        .select('name clientId emails currency address')
        .lean();
    const byId = new Map(clients.map((c) => [String(c._id), c]));
    return rows
        .map((r) => ({ client: byId.get(String(r._id)), orders: r.orders, uninvoiced: r.uninvoiced, images: r.images }))
        .filter((r) => r.client)
        .sort((a, b) => a.client!.name.localeCompare(b.client!.name));
}

/** A client's non-cancelled orders in the month. */
async function invoiceOrders(clientId: string, month: number, year: number) {
    return PhotoOrderModel.find({ clientId: oid(clientId), orderDate: monthRange(year, month), status: { $ne: 'cancelled' } })
        .sort({ orderDate: 1 })
        .populate([{ path: 'services', select: 'name' }])
        .lean();
}

async function nextInvoiceNumber(): Promise<string> {
    const c = await PhotoInvoiceCounter.findByIdAndUpdate('photo_invoice', { $inc: { seq: 1 } }, { new: true, upsert: true });
    return `PI-${String(c.seq).padStart(4, '0')}`;
}

const payUrl = (token: string) => {
    const base = envConfig.payment_client_url.replace(/\/+$/, '');
    return base ? `${base}/payment/${encodeURIComponent(token)}` : '';
};

/** The invoice with its client and (while unpaid) its Pay Now link. */
async function withPayment(invoice: IPhotoInvoice | (Record<string, unknown> & { _id: unknown })) {
    const inv = invoice as unknown as IPhotoInvoice;
    const client = await ClientModel.findById(inv.clientId).select('name clientId emails currency address phone').lean();
    const issued = inv.paymentStatus === 'pending' ? await PaymentService.issueTokenForPhotoInvoice(String(inv._id)) : null;
    const plain = typeof (invoice as { toObject?: unknown }).toObject === 'function' ? (invoice as unknown as IPhotoInvoice).toObject() : invoice;
    return { ...plain, client, paymentUrl: issued ? payUrl(issued.token) : '' };
}

async function createInvoice(input: { clientId: string; month: number; year: number; orderIds: string[]; dueDate?: Date }, userId: string) {
    const ids = [...new Set(input.orderIds)];
    const orders = await PhotoOrderModel.find({ _id: { $in: ids }, clientId: input.clientId, status: { $ne: 'cancelled' } }).sort({ orderDate: 1 });
    if (!ids.length || orders.length !== ids.length) throw new AppError('Some selected orders were not found for this client', 404);
    const range = monthRange(input.year, input.month);
    if (orders.some((o) => o.orderDate < range.$gte || o.orderDate > range.$lte)) throw new AppError('All orders must belong to the selected month', 400);
    const taken = orders.find((o) => o.invoiceId);
    if (taken) throw new AppError(`"${taken.orderName}" is already on invoice ${taken.invoiceNumber}`, 409);

    const client = await ClientModel.findById(input.clientId).select('currency').lean();
    const items = orders.map((o) => ({
        orderId: o._id,
        orderName: o.orderName,
        date: o.orderDate,
        images: o.imageQuantity,
        unitPrice: o.perImagePrice,
        amount: o.totalPrice,
    }));
    const issueDate = new Date();
    const invoice = await PhotoInvoiceModel.create({
        invoiceNumber: await nextInvoiceNumber(),
        clientId: input.clientId,
        month: input.month,
        year: input.year,
        currency: client?.currency || 'USD',
        items,
        totalImages: items.reduce((a, i) => a + i.images, 0),
        totalAmount: Math.round(items.reduce((a, i) => a + i.amount, 0) * 100) / 100,
        issueDate,
        dueDate: input.dueDate ?? new Date(issueDate.getTime() + INVOICE_DUE_DAYS * 86_400_000),
        createdBy: userId,
    });
    try {
        await PhotoOrderModel.updateMany({ _id: { $in: ids } }, { $set: { invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber } });
    } catch (err) {
        await invoice.deleteOne();
        throw err;
    }
    return withPayment(invoice);
}

async function listInvoices(f: { clientId?: string; month?: number; year?: number; status?: 'pending' | 'paid' }) {
    const q: Record<string, unknown> = {};
    if (f.clientId) q.clientId = oid(f.clientId);
    if (f.month) q.month = f.month;
    if (f.year) q.year = f.year;
    if (f.status) q.paymentStatus = f.status;
    return PhotoInvoiceModel.find(q).sort({ createdAt: -1 }).populate('clientId', 'name clientId emails currency').lean();
}

async function getInvoice(id: string) {
    const inv = await PhotoInvoiceModel.findById(id);
    if (!inv) throw new AppError('Invoice not found', 404);
    return withPayment(inv);
}

async function deleteInvoice(id: string) {
    const inv = await PhotoInvoiceModel.findById(id);
    if (!inv) throw new AppError('Invoice not found', 404);
    if (inv.paymentStatus === 'paid') throw new AppError('A paid invoice cannot be deleted', 409);
    // a payment link for a deleted invoice must stop working
    await PaymentTokenModel.updateMany({ photoInvoiceId: inv._id, status: 'active' }, { $set: { status: 'void' } });
    await PhotoOrderModel.updateMany({ invoiceId: inv._id }, { $unset: { invoiceId: '', invoiceNumber: '' } });
    await inv.deleteOne();
}

async function markEmailed(id: string, to: string[]) {
    await PhotoInvoiceModel.updateOne({ _id: id }, { $addToSet: { emailedTo: { $each: to } } });
}

export default {
    listOrders, getOrder, createOrder, updateOrder, deleteOrder, changeStatus, extendDeadline, addRevision, orderStats, orderYears,
    listServices, createService, updateService, deleteService, listFormats, createFormat, updateFormat, deleteFormat,
    invoiceClients, invoiceOrders, createInvoice, listInvoices, getInvoice, deleteInvoice, markEmailed,
};
