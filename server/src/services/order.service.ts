import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import OrderModel, {
    type IOrder,
    type IQuotationSnapshot,
    OrderStatus,
    OrderType,
} from '../models/order.model.js';
import QuotationModel from '../models/quotation.model.js';
import { AppError } from '../utils/AppError.js';
import { InvoiceCounter } from '../models/invoice-counter.model.js';
import type { IQuotation } from '../types/quotation.type.js';
import { logger } from '../lib/logger.js';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function deepFreeze<T extends object>(obj: T): Readonly<T> {
    if (obj === null || typeof obj !== 'object') return obj;

    // Do not freeze special objects like ObjectId, Date, Buffer, or Mongoose documents.
    // We only want to freeze plain objects and arrays.
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== Array.prototype) return obj;

    Object.getOwnPropertyNames(obj).forEach((name) => {
        const value = (obj as Record<string, unknown>)[name];
        if (value !== null && typeof value === 'object') {
            deepFreeze(value as object);
        }
    });
    return Object.freeze(obj);
}

async function generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await InvoiceCounter.findByIdAndUpdate(
        { _id: `order_${year}` },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
    );
    return `ORD-${year}-${counter.seq.toString().padStart(5, '0')}`;
}

function buildQuotationSnapshot(
    quotation: IQuotation,
): Readonly<IQuotationSnapshot> {
    // ── Critical field guards ─────────────────────────────────────────────────
    if (!quotation._id)
        throw new AppError(
            'Snapshot build failed: quotation._id is missing',
            500,
        );
    if (!quotation.quotationGroupId)
        throw new AppError(
            'Snapshot build failed: quotationGroupId is missing',
            500,
        );
    if (!quotation.quotationNumber)
        throw new AppError(
            'Snapshot build failed: quotationNumber is missing',
            500,
        );
    if (!quotation.serviceType)
        throw new AppError(
            'Snapshot build failed: serviceType is missing',
            500,
        );
    if (quotation.version == null || quotation.version < 1)
        throw new AppError(
            'Snapshot build failed: version is missing or invalid',
            500,
        );
    if (!quotation.clientId)
        throw new AppError('Snapshot build failed: clientId is missing', 500);
    if (!quotation.client?.contactName)
        throw new AppError(
            'Snapshot build failed: client.contactName is missing',
            500,
        );
    if (!quotation.client?.email)
        throw new AppError(
            'Snapshot build failed: client.email is missing',
            500,
        );
    if (!quotation.details?.title)
        throw new AppError(
            'Snapshot build failed: details.title is missing',
            500,
        );
    if (quotation.totals?.grandTotal == null)
        throw new AppError(
            'Snapshot build failed: totals.grandTotal is missing',
            500,
        );
    if (quotation.totals?.taxAmount == null)
        throw new AppError(
            'Snapshot build failed: totals.taxAmount is missing',
            500,
        );
    if (quotation.totals?.discountAmount == null)
        throw new AppError(
            'Snapshot build failed: totals.discountAmount is missing',
            500,
        );

    // ── Service validation — fail loud on any invalid service entry ──────────
    const services = quotation.services ?? [];
    if (services.length === 0) {
        throw new AppError(
            'Snapshot build failed: quotation has no services selected',
            500,
        );
    }
    services.forEach((s, i) => {
        if (s == null || typeof s.category !== 'string' || s.category.trim() === '') {
            throw new AppError(
                `Snapshot build failed: services[${i}] is invalid or missing category`,
                500,
            );
        }
        (s.lineItems ?? []).forEach((item, j) => {
            if (item == null || typeof item.price !== 'number' || isNaN(item.price)) {
                throw new AppError(
                    `Snapshot build failed: services[${i}].lineItems[${j}].price is invalid`,
                    500,
                );
            }
        });
    });

    const CATEGORY_LABELS: Record<string, string> = {
        'web-development': 'Web Design & Development',
        marketing: 'Marketing',
        'photo-editing': 'Photo Editing',
        'video-editing': 'Video Editing',
    };

    const scopeOfWork = services.map((s) => ({
        title: CATEGORY_LABELS[s.category] || s.category,
        description: typeof s.scopeDescription === 'string' ? s.scopeDescription : '',
        items: Array.isArray(s.scopeItems) ? [...s.scopeItems] : [],
    }));

    const overviewText = typeof quotation.overview === 'string' ? quotation.overview.trim().toLowerCase() : '';

    const snapshotServices = services.map((s) => {
        const rawDesc = typeof s.scopeDescription === 'string' ? s.scopeDescription.trim() : '';
        const isDuplicateOverview = rawDesc && overviewText && (
            rawDesc.toLowerCase() === overviewText ||
            overviewText.includes(rawDesc.toLowerCase()) ||
            rawDesc.toLowerCase().includes(overviewText)
        );
        const scopeDescription = isDuplicateOverview ? '' : rawDesc;

        return {
            category: s.category,
            ...(scopeDescription ? { scopeDescription } : {}),
            scopeItems: Array.isArray(s.scopeItems) ? [...s.scopeItems] : [],
            basePrice: Number(s.basePrice) || 0,
            lineItems: (s.lineItems ?? []).map((item) => ({
                title: String(item.title || ''),
                price: Number(item.price) || 0,
                billingCycle: item.billingCycle || 'one-time',
                ...(typeof item.quantity === 'number' ? { quantity: item.quantity } : {}),
                ...(item.description ? { description: String(item.description) } : {}),
            })),
            discount: Number(s.discount) || 0,
            taxRate: Number(s.taxRate) || 0,
        };
    });

    const recurringCharges = (quotation.recurringCharges ?? []).map((item) => ({
        title: String(item.title || ''),
        price: Number(item.price) || 0,
        billingCycle: item.billingCycle || 'monthly',
        ...(typeof item.quantity === 'number' ? { quantity: item.quantity } : {}),
        ...(item.description ? { description: String(item.description) } : {}),
    }));

    // ── Currency: trim → uppercase → fallback USD ─────────────────────────────
    const paymentMilestones = Array.isArray(quotation.paymentMilestones)
        ? quotation.paymentMilestones.map((m) => ({
              label: String(m.label || ''),
              percentage: Number(m.percentage) || 0,
              ...(m.note ? { note: String(m.note) } : {}),
          }))
        : [];

    const rawCurrency =
        typeof quotation.currency === 'string' ? quotation.currency.trim() : '';
    const currency = rawCurrency !== '' ? rawCurrency.toUpperCase() : 'USD';

    return deepFreeze<IQuotationSnapshot>({
        quotationId: quotation._id as Types.ObjectId,
        quotationGroupId: quotation.quotationGroupId,
        version: quotation.version,
        quotationNumber: quotation.quotationNumber,
        serviceType: quotation.serviceType,
        templateName: quotation.details?.title || 'Quotation Project',
        clientId: quotation.clientId,
        clientName: quotation.client?.contactName || 'Client',
        clientEmail: quotation.client?.email || '',
        ...(quotation.details ? { details: quotation.details } : {}),
        ...(typeof quotation.overview === 'string'
            ? { overview: quotation.overview }
            : {}),
        scopeOfWork,
        services: snapshotServices,
        recurringCharges,
        paymentMilestones,
        notIncluded: Array.isArray(quotation.notIncluded) ? [...quotation.notIncluded] : [],
        clientRequirements: Array.isArray(quotation.clientRequirements) ? [...quotation.clientRequirements] : [],
        workflow: Array.isArray(quotation.workflow) ? [...quotation.workflow] : [],
        currency,
        grandTotal: quotation.totals?.grandTotal || 0,
        discountAmount: quotation.totals?.discountAmount || 0,
        taxAmount: quotation.totals?.taxAmount || 0,
        totals: quotation.totals ? { ...quotation.totals } : undefined,
    });
}

/**
 * [NEW] Enriches order documents with their corresponding payment phase statuses.
 * This is used to drive dynamic UI logic in the dashboard.
 */
async function enrichOrdersWithPaymentInfo(orders: any[]): Promise<any[]> {
    if (!orders.length) return [];
    return orders.map(order => (order.toObject ? order.toObject() : order));
}

// ─── OrderService ─────────────────────────────────────────────────────────────

/**
 * Creates an order from an accepted quotation. Called from
 * `POST /api/orders/convert-quotation` (staff-triggered).
 *
 * IDEMPOTENCY GUARD: Checks for existing order with this quotationGroupId
 * inside the transaction. If one already exists, returns it without creating a duplicate.
 */
async function createOrderFromQuotation(
    quotationGroupId: string,
    createdBy: string,
): Promise<IOrder> {
    logger.info(
        { quotationGroupId, createdBy },
        'order.create_from_quotation.requested',
    );
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Idempotency: if order already exists for this group, return it
        const existing = await OrderModel.findOne({ quotationGroupId }).session(
            session,
        );
        if (existing) {
            await session.abortTransaction();
            logger.info(
                {
                    quotationGroupId,
                    orderId: existing._id.toString(),
                    orderNumber: existing.orderNumber,
                },
                'order.create_from_quotation.idempotent_hit',
            );
            return existing;
        }

        // Fetch and validate the quotation. Allow draft/sent/viewed to be manually converted.
        const quotation = await QuotationModel.findOne({
            quotationGroupId,
            isLatestVersion: true,
            status: { $nin: ['superseded', 'expired'] },
        }).session(session);

        if (!quotation) {
            throw new AppError(
                `No valid active quotation found for group ${quotationGroupId}. Cannot create order.`,
                422,
            );
        }

        // If it wasn't accepted yet, explicitly accept it now.
        if (quotation.status !== 'accepted') {
            quotation.status = 'accepted';
            await quotation.save({ session });
        }

        const orderNumber = await generateOrderNumber();
        const snapshot = buildQuotationSnapshot(quotation);

        const orderType =
            quotation.serviceType === 'web-development'
                ? OrderType.PROJECT
                : OrderType.SERVICE;

        // If triggered by a public webhook/client action, use the staff member who created the quotation
        const actualCreatedBy =
            createdBy && createdBy !== '000000000000000000000000'
                ? createdBy
                : quotation.createdBy.toString();

        const [order] = await OrderModel.create(
            [
                {
                    orderNumber,
                    quotationGroupId,
                    quotationSnapshot: snapshot,
                    clientId: quotation.clientId,
                    orderType,
                    status: OrderStatus.PENDING,
                    statusHistory: [
                        {
                            status: OrderStatus.PENDING,
                            changedBy: new Types.ObjectId(actualCreatedBy),
                            updatedAt: new Date(),
                            note: 'Order created from accepted quotation',
                        },
                    ],
                    assets: [],
                    milestones: [],
                    totalPrice: snapshot.grandTotal,
                    currency: snapshot.currency,
                    imageQuantity: 0,
                    createdBy: new Types.ObjectId(actualCreatedBy),
                },

            ],
            { session },
        );

        if (!order) {
            throw new AppError('Failed to create order document', 500);
        }

        // Back-reference: write orderId onto the quotation
        await QuotationModel.findByIdAndUpdate(
            quotation._id,
            { $set: { orderId: order._id } },
            { session },
        );

        await session.commitTransaction();
        logger.info(
            {
                quotationGroupId,
                orderId: order._id.toString(),
                orderNumber: order.orderNumber,
            },
            'order.create_from_quotation.completed',
        );
        return order;
    } catch (err) {
        await session.abortTransaction();
        logger.error(
            { err, quotationGroupId },
            'order.create_from_quotation.failed',
        );
        throw err;
    } finally {
        session.endSession();
    }
}

/**
 * Transition order status. Staff may set any status directly — no
 * workflow-order restriction — but the update stays optimistic-concurrency
 * safe and still runs the delivered/completed asset-unlock side effect.
 */
async function transitionStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string,
    note?: string,
): Promise<IOrder> {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    const updated = await OrderModel.findOneAndUpdate(
        { _id: order._id, __v: order.__v },
        {
            $set: { 
                status: newStatus,
                ...(newStatus === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
                ...(newStatus === OrderStatus.COMPLETED ? { completedAt: new Date() } : {}),
            },
            $push: {
                statusHistory: {
                    status: newStatus,
                    changedBy: new Types.ObjectId(userId),
                    updatedAt: new Date(),
                    note: note || `Status updated to ${newStatus}`,
                },
            },
        },
        { new: true },
    );


    if (!updated)
        throw new AppError(
            'Order was modified concurrently. Please retry.',
            409,
        );

    // [NEW] Asset Unlocking Side Effect for manual transitions
    // If staff manually moves to delivered/completed, ensure assets are unlocked
    if (newStatus === OrderStatus.DELIVERED || newStatus === OrderStatus.COMPLETED) {
        const needsUnlock = updated.assets.some(a => a.isLocked);
        if (needsUnlock) {
            logger.info({ orderId, newStatus }, 'order.transition.triggering_manual_unlock');
            await unlockAssets(orderId);
        }
    }

    return updated;
}

/**
 * Unlock all assets after delivery payment (30%) is confirmed.
 *
 * Each asset gets a unique time-limited accessToken (crypto.randomBytes).
 * The raw encryptedValue is never exposed — the client must present the accessToken
 * to a dedicated asset-serving endpoint which decrypts and streams the value.
 *
 * IDEMPOTENT: Re-calling this on an already-unlocked order is safe — it regenerates tokens.
 */
async function unlockAssets(orderId: string): Promise<IOrder> {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    const accessTokenExpiresAt = new Date();
    accessTokenExpiresAt.setDate(accessTokenExpiresAt.getDate() + 7); // 7-day access window

    const plainAssets = order.toObject().assets || [];
    const updatedAssets = plainAssets.map((asset) => ({
        ...asset,
        isLocked: false,
        accessToken: crypto.randomBytes(32).toString('hex'),
        accessTokenExpiresAt,
        unlockedAt: asset.unlockedAt ?? new Date(),
    }));

    const updated = await OrderModel.findByIdAndUpdate(
        orderId,
        {
            $set: {
                assets: updatedAssets,
                status: OrderStatus.DELIVERED,
            },
            $push: {
                statusHistory: {
                    status: OrderStatus.DELIVERED,
                    changedBy: new Types.ObjectId('000000000000000000000000'), // system actor
                    updatedAt: new Date(),
                    note: 'Assets unlocked. Order moved to delivered status.',
                },
            },
        },
        { new: true },
    );

    if (!updated)
        throw new AppError('Order not found during asset unlock', 404);
    return updated;
}

async function getAllOrdersFromDB(query: any) {
    const { page = 1, limit = 10, search, status, orderType, clientId } = query;
    const filter: any = {};

    if (search)
        filter['quotationSnapshot.templateName'] = {
            $regex: search,
            $options: 'i',
        };
    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;
    if (clientId) filter.clientId = clientId;

    const [data, total] = await Promise.all([
        OrderModel.find(filter)
            .populate('clientId', 'name clientId emails')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit)),
        OrderModel.countDocuments(filter),
    ]);
    const enrichedData = await enrichOrdersWithPaymentInfo(data);

    return {
        data: enrichedData,
        meta: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit)),
        },
    };
}

async function getOrderByIdFromDB(id: string) {
    const order = await OrderModel.findById(id).populate('clientId');
    if (!order) return null;
    const [enriched] = await enrichOrdersWithPaymentInfo([order]);
    return enriched;
}

/**
 * Serve a single asset value after validating the client's accessToken.
 * NEVER returns the encryptedValue directly.
 */
async function getAssetByAccessToken(
    orderId: string,
    assetId: string,
    accessToken: string,
) {
    const order = await OrderModel.findById(orderId).select(
        '+assets.accessToken',
    );
    if (!order) throw new AppError('Order not found', 404);

    const asset = order.assets.find((a: any) => a._id?.toString() === assetId);
    if (!asset) throw new AppError('Asset not found', 404);
    if (asset.isLocked)
        throw new AppError('Asset is locked pending delivery payment', 403);

    if (asset.accessToken !== accessToken)
        throw new AppError('Invalid asset access token', 403);
    if (asset.accessTokenExpiresAt && asset.accessTokenExpiresAt < new Date()) {
        throw new AppError(
            'Asset access token has expired. Please request asset re-delivery.',
            403,
        );
    }

    // In production: decrypt asset.encryptedValue here using KMS key
    // For now: return the stored value (assume it's already plaintext in dev)
    return {
        type: asset.type,
        label: asset.label,
        value: asset.encryptedValue, // TODO: decrypt with AWS KMS in production
    };
}

async function updateOrderTeam(
    orderId: string, 
    payload: { assignedTeam?: string[]; teamLeader?: string }
): Promise<IOrder> {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    const update: any = {};
    if (payload.assignedTeam) {
        update.assignedTeam = payload.assignedTeam.map(id => new Types.ObjectId(id));
    }
    if (payload.teamLeader !== undefined) {
        update.teamLeader = payload.teamLeader ? new Types.ObjectId(payload.teamLeader) : null;
    }

    const updated = await OrderModel.findByIdAndUpdate(
        orderId,
        { $set: update },
        { new: true }
    );

    if (!updated) throw new AppError('Order not found', 404);
    return updated;
}

export default {
    createOrderFromQuotation,
    transitionStatus,
    unlockAssets,
    getAllOrdersFromDB,
    getOrderByIdFromDB,
    getAssetByAccessToken,
    updateOrderTeam,
};
