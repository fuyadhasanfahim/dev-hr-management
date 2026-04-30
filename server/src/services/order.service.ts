import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import OrderModel, {
    type IOrder,
    type IQuotationSnapshot,
    OrderStatus,
    OrderType,
    ALLOWED_STATUS_TRANSITIONS,
    AssetType,
} from '../models/order.model.js';
import QuotationModel from '../models/quotation.model.js';
import { AppError } from '../utils/AppError.js';
import { InvoiceCounter } from '../models/invoice-counter.model.js';
import type { IQuotation } from '../types/quotation.type.js';
import { logger } from '../lib/logger.js';
import emailService from './email.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deepFreeze<T extends object>(obj: T): Readonly<T> {
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

function buildQuotationSnapshot(quotation: IQuotation): Readonly<IQuotationSnapshot> {
    // ── Critical field guards ─────────────────────────────────────────────────
    if (!quotation._id)
        throw new AppError('Snapshot build failed: quotation._id is missing', 500);
    if (!quotation.quotationGroupId)
        throw new AppError('Snapshot build failed: quotationGroupId is missing', 500);
    if (!quotation.quotationNumber)
        throw new AppError('Snapshot build failed: quotationNumber is missing', 500);
    if (!quotation.serviceType)
        throw new AppError('Snapshot build failed: serviceType is missing', 500);
    if (quotation.version == null || quotation.version < 1)
        throw new AppError('Snapshot build failed: version is missing or invalid', 500);
    if (!quotation.clientId)
        throw new AppError('Snapshot build failed: clientId is missing', 500);
    if (!quotation.client?.contactName)
        throw new AppError('Snapshot build failed: client.contactName is missing', 500);
    if (!quotation.client?.email)
        throw new AppError('Snapshot build failed: client.email is missing', 500);
    if (!quotation.details?.title)
        throw new AppError('Snapshot build failed: details.title is missing', 500);
    if (quotation.totals?.grandTotal == null)
        throw new AppError('Snapshot build failed: totals.grandTotal is missing', 500);
    if (quotation.totals?.taxAmount == null)
        throw new AppError('Snapshot build failed: totals.taxAmount is missing', 500);

    // ── Phase validation — fail loud on any invalid phase entry ──────────────
    const phases = quotation.phases ?? [];
    phases.forEach((p, i) => {
        if (p == null || typeof p.title !== 'string' || p.title.trim() === '') {
            throw new AppError(
                `Snapshot build failed: phases[${i}] is invalid or missing title`,
                500,
            );
        }
    });

    const scopeOfWork = phases.map((p) => ({
        title:       p.title,
        description: typeof p.description === 'string' ? p.description : '',
        items:       Array.isArray(p.items) ? [...p.items] : [],
    }));

    // ── additionalServices — optional; each entry must have a numeric price ───
    const additionalServicesTotal = Array.isArray(quotation.additionalServices)
        ? quotation.additionalServices.reduce((sum, svc, i) => {
              if (svc == null || typeof svc.price !== 'number' || isNaN(svc.price)) {
                  throw new AppError(
                      `Snapshot build failed: additionalServices[${i}].price is invalid`,
                      500,
                  );
              }
              return sum + svc.price;
          }, 0)
        : 0;

    // ── Currency: trim → uppercase → fallback USD ─────────────────────────────
    const rawCurrency = typeof quotation.currency === 'string' ? quotation.currency.trim() : '';
    const currency = rawCurrency !== '' ? rawCurrency.toUpperCase() : 'USD';

    // ── Pricing fields must be present ────────────────────────────────────────
    if (quotation.pricing?.taxRate == null)
        throw new AppError('Snapshot build failed: pricing.taxRate is missing', 500);
    if (quotation.pricing?.discount == null)
        throw new AppError('Snapshot build failed: pricing.discount is missing', 500);

    return deepFreeze<IQuotationSnapshot>({
        quotationId:            quotation._id as Types.ObjectId,
        quotationGroupId:       quotation.quotationGroupId,
        version:                quotation.version,
        quotationNumber:        quotation.quotationNumber,
        serviceType:            quotation.serviceType,
        templateName:           quotation.details.title,
        clientId:               quotation.clientId,
        clientName:             quotation.client.contactName,
        clientEmail:            quotation.client.email,
        overview:               typeof quotation.overview === 'string' ? quotation.overview : undefined,
        scopeOfWork,
        currency,
        grandTotal:             quotation.totals.grandTotal,
        taxRate:                quotation.pricing.taxRate,
        discount:               quotation.pricing.discount,
        additionalServicesTotal,
        taxAmount:              quotation.totals.taxAmount,
    });
}

// ─── OrderService ─────────────────────────────────────────────────────────────

/**
 * INTERNAL ONLY — not exposed via HTTP route.
 * Called exclusively from the QuotationEventWorker after upfront payment succeeds.
 *
 * IDEMPOTENCY GUARD: Checks for existing order with this quotationGroupId
 * inside the transaction. If one already exists, returns it without creating a duplicate.
 */
async function createOrderFromQuotation(quotationGroupId: string, createdBy: string): Promise<IOrder> {
    logger.info({ quotationGroupId, createdBy }, 'order.create_from_quotation.requested');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Idempotency: if order already exists for this group, return it
        const existing = await OrderModel.findOne({ quotationGroupId }).session(session);
        if (existing) {
            await session.abortTransaction();
            logger.info(
                { quotationGroupId, orderId: existing._id.toString(), orderNumber: existing.orderNumber },
                'order.create_from_quotation.idempotent_hit',
            );
            return existing;
        }

        // Fetch and validate the accepted quotation
        const quotation = await QuotationModel.findOne({
            quotationGroupId,
            isLatestVersion: true,
            status: 'accepted',
        }).session(session);

        if (!quotation) {
            throw new AppError(
                `No accepted quotation found for group ${quotationGroupId}. Cannot create order.`,
                422,
            );
        }

        const orderNumber = await generateOrderNumber();
        const snapshot = buildQuotationSnapshot(quotation);

        const orderType = quotation.serviceType === 'web-development'
            ? OrderType.PROJECT
            : OrderType.SERVICE;

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
                            changedBy: new Types.ObjectId(createdBy),
                            updatedAt: new Date(),
                            note: 'Order created automatically after upfront payment confirmation',
                        },
                    ],
                    assets: [],
                    milestones: [],
                    createdBy: new Types.ObjectId(createdBy),
                },
            ],
            { session },
        );

        // Back-reference: write orderId onto the quotation
        await QuotationModel.findByIdAndUpdate(
            quotation._id,
            { $set: { orderId: order._id } },
            { session },
        );

        await session.commitTransaction();
        logger.info(
            { quotationGroupId, orderId: order._id.toString(), orderNumber: order.orderNumber },
            'order.create_from_quotation.completed',
        );
        return order;
    } catch (err) {
        await session.abortTransaction();
        logger.error({ err, quotationGroupId }, 'order.create_from_quotation.failed');
        throw err;
    } finally {
        session.endSession();
    }
}

/**
 * Transition order status through the state machine.
 * Rejects transitions not in ALLOWED_STATUS_TRANSITIONS.
 */
async function transitionStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string,
    note?: string,
): Promise<IOrder> {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    const allowed = ALLOWED_STATUS_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
        throw new AppError(
            `Invalid status transition: ${order.status} → ${newStatus}. ` +
            `Allowed next states: [${allowed.join(', ')}]`,
            409,
        );
    }

    const updated = await OrderModel.findOneAndUpdate(
        { _id: order._id, __v: order.__v },
        {
            $set: { status: newStatus },
            $push: {
                statusHistory: {
                    status: newStatus,
                    changedBy: new Types.ObjectId(userId),
                    updatedAt: new Date(),
                    note,
                },
            },
        },
        { new: true },
    );

    if (!updated) throw new AppError('Order was modified concurrently. Please retry.', 409);
    return updated;
}

/**
 * Staff marks order as delivered.
 * RULE: At least one asset must be uploaded before delivery can be marked.
 */
async function markDelivered(orderId: string, userId: string): Promise<IOrder> {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    if (order.status !== OrderStatus.IN_PROGRESS) {
        throw new AppError(`Order must be in_progress to mark as delivered. Current: ${order.status}`, 409);
    }

    if (!order.assets || order.assets.length === 0) {
        throw new AppError(
            'Cannot mark as delivered: no assets have been uploaded. Add at least one deliverable asset first.',
            422,
        );
    }

    const updated = await OrderModel.findOneAndUpdate(
        { _id: order._id, __v: order.__v, status: OrderStatus.IN_PROGRESS },
        {
            $set: {
                status: OrderStatus.DELIVERED,
                deliveredAt: new Date(),
            },
            $push: {
                statusHistory: {
                    status: OrderStatus.DELIVERED,
                    changedBy: new Types.ObjectId(userId),
                    updatedAt: new Date(),
                    note: 'Delivery marked by team',
                },
            },
        },
        { new: true },
    );

    if (!updated) throw new AppError('Order was modified concurrently. Please retry.', 409);

    // Best-effort: notify client via email (do not block delivery status change if SMTP fails).
    try {
        const to = updated.quotationSnapshot?.clientEmail;
        if (to) {
            await emailService.sendOrderStatusEmail({
                to,
                clientName: updated.quotationSnapshot?.clientName || 'Client',
                orderName: updated.quotationSnapshot?.templateName || updated.orderNumber,
                status: OrderStatus.DELIVERED,
                message:
                    'Your order has been marked as delivered. If any payment is still pending, please complete it to unlock deliverables.',
            });
        } else {
            logger.warn({ orderId }, 'order.delivered.email_skipped_missing_client_email');
        }
    } catch (err) {
        logger.error({ err, orderId }, 'order.delivered.email_failed');
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

    const updatedAssets = order.assets.map((asset) => ({
        ...asset.toObject(),
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
                status: OrderStatus.APPROVED,
            },
            $push: {
                statusHistory: {
                    status: OrderStatus.APPROVED,
                    changedBy: new Types.ObjectId('000000000000000000000000'), // system actor
                    updatedAt: new Date(),
                    note: 'Assets unlocked after delivery payment confirmation',
                },
            },
        },
        { new: true },
    );

    if (!updated) throw new AppError('Order not found during asset unlock', 404);
    return updated;
}

/**
 * Complete the order after final payment (20%) is confirmed.
 */
async function completeOrder(orderId: string): Promise<IOrder> {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    if (order.status !== OrderStatus.APPROVED) {
        throw new AppError(`Order must be in approved state to complete. Current: ${order.status}`, 409);
    }

    const updated = await OrderModel.findOneAndUpdate(
        { _id: order._id, __v: order.__v, status: OrderStatus.APPROVED },
        {
            $set: {
                status: OrderStatus.COMPLETED,
                completedAt: new Date(),
            },
            $push: {
                statusHistory: {
                    status: OrderStatus.COMPLETED,
                    changedBy: new Types.ObjectId('000000000000000000000000'),
                    updatedAt: new Date(),
                    note: 'Order completed after final payment confirmation',
                },
            },
        },
        { new: true },
    );

    if (!updated) throw new AppError('Order was modified concurrently during completion.', 409);
    return updated;
}

async function getAllOrdersFromDB(query: any) {
    const { page = 1, limit = 10, search, status, orderType, clientId } = query;
    const filter: any = {};

    if (search) filter['quotationSnapshot.templateName'] = { $regex: search, $options: 'i' };
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

    return {
        data,
        meta: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit)),
        },
    };
}

async function getOrderByIdFromDB(id: string) {
    return OrderModel.findById(id).populate('clientId');
}

/**
 * Serve a single asset value after validating the client's accessToken.
 * NEVER returns the encryptedValue directly.
 */
async function getAssetByAccessToken(orderId: string, assetId: string, accessToken: string) {
    const order = await OrderModel.findById(orderId).select('+assets.accessToken');
    if (!order) throw new AppError('Order not found', 404);

    const asset = order.assets.id(assetId);
    if (!asset) throw new AppError('Asset not found', 404);
    if (asset.isLocked) throw new AppError('Asset is locked pending delivery payment', 403);

    if (asset.accessToken !== accessToken) throw new AppError('Invalid asset access token', 403);
    if (asset.accessTokenExpiresAt && asset.accessTokenExpiresAt < new Date()) {
        throw new AppError('Asset access token has expired. Please request asset re-delivery.', 403);
    }

    // In production: decrypt asset.encryptedValue here using KMS key
    // For now: return the stored value (assume it's already plaintext in dev)
    return {
        type: asset.type,
        label: asset.label,
        value: asset.encryptedValue, // TODO: decrypt with AWS KMS in production
    };
}

export default {
    createOrderFromQuotation,
    transitionStatus,
    markDelivered,
    unlockAssets,
    completeOrder,
    getAllOrdersFromDB,
    getOrderByIdFromDB,
    getAssetByAccessToken,
};
