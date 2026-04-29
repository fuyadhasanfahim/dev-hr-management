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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await InvoiceCounter.findByIdAndUpdate(
        { _id: `order_${year}` },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
    );
    return `ORD-${year}-${counter.seq.toString().padStart(5, '0')}`;
}

function buildQuotationSnapshot(quotation: IQuotation): IQuotationSnapshot {
    return {
        quotationId: quotation._id as Types.ObjectId,
        quotationGroupId: quotation.quotationGroupId,
        version: quotation.version,
        quotationNumber: quotation.quotationNumber,
        serviceType: quotation.serviceType,
        templateName: quotation.details.title,
        clientId: quotation.clientId,
        clientName: quotation.client.contactName,
        clientEmail: quotation.client.email,
        overview: quotation.overview,
        scopeOfWork: (quotation.scopeOfWork || []).map((s) => ({
            title: s.title,
            description: s.description,
            items: s.items,
        })),
        deliveryTimeline: quotation.deliveryTimeline,
        currency: quotation.settings.currency || 'USD',
        grandTotal: quotation.totals.grandTotal,
        taxRate: quotation.settings.taxRate,
        discount: quotation.settings.discount,
        packagePrice: quotation.totals.packagePrice,
        additionalTotal: quotation.totals.additionalTotal,
        taxAmount: quotation.totals.taxAmount,
    };
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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Idempotency: if order already exists for this group, return it
        const existing = await OrderModel.findOne({ quotationGroupId }).session(session);
        if (existing) {
            await session.abortTransaction();
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
        return order;
    } catch (err) {
        await session.abortTransaction();
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
