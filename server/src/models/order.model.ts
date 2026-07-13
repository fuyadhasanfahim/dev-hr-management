import { Schema, model, Document, Types } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum OrderStatus {
    PENDING            = 'pending',
    IN_PROGRESS        = 'in_progress',       // team working
    REVISION           = 'revision',          // client requested changes
    COMPLETED          = 'completed',
    DELIVERED          = 'delivered',          // team marked delivered
    CANCELLED          = 'cancelled',
}

export enum OrderType {
    PROJECT      = 'project',
    SERVICE      = 'service',
    SUBSCRIPTION = 'subscription',
}

export enum AssetType {
    GITHUB_REPO  = 'github_repo',
    FILE         = 'file',
    URL          = 'url',
    CREDENTIAL   = 'credential',
}

// ─── Valid Status Transitions ─────────────────────────────────────────────────
// Enforced in OrderService.transitionStatus — not here (schema is not the place for flow logic)
export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]:      [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
    [OrderStatus.IN_PROGRESS]:  [OrderStatus.COMPLETED, OrderStatus.REVISION, OrderStatus.CANCELLED],
    [OrderStatus.REVISION]:     [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
    [OrderStatus.COMPLETED]:    [OrderStatus.DELIVERED, OrderStatus.REVISION],
    [OrderStatus.DELIVERED]:    [OrderStatus.REVISION],
    [OrderStatus.CANCELLED]:    [],
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface IOrderAsset {
    type: AssetType;
    label: string;
    /**
     * Stored encrypted at rest via application-level AES-256-GCM.
     * Plain value is NEVER stored.
     */
    encryptedValue: string;
    isLocked: boolean;
    /**
     * Time-limited access token generated on unlock (crypto.randomBytes).
     * Client presents this token to retrieve the decrypted value.
     * Rotated on each unlock request.
     */
    accessToken?: string;
    accessTokenExpiresAt?: Date;
    unlockedAt?: Date;
}

export interface IOrderMilestone {
    milestone: string;
    completedAt: Date;
    completedBy: Types.ObjectId;
    notes?: string;
}

export interface IStatusHistory {
    status: OrderStatus;
    changedBy: Types.ObjectId;
    updatedAt: Date;
    note?: string;
}

export interface IQuotationSnapshotLineItem {
    title: string;
    price: number;
    billingCycle: 'one-time' | 'monthly' | 'yearly' | 'per-image' | 'per-video';
    quantity?: number;
    description?: string | undefined;
}

/** Per-service pricing/scope breakdown, frozen at order-creation time. */
export interface IQuotationSnapshotService {
    category: string;
    scopeDescription?: string;
    scopeItems: string[];
    basePrice: number;
    lineItems: IQuotationSnapshotLineItem[];
    discount: number; // Percentage
    taxRate: number; // Percentage
}

/**
 * Immutable snapshot of the quotation at the time the order was created.
 * Once written, this sub-document MUST NOT be mutated.
 * All financial and scope decisions derive from this snapshot.
 */
export interface IQuotationSnapshot {
    quotationId: Types.ObjectId;
    quotationGroupId: string;
    version: number;
    quotationNumber: string;
    serviceType: string;
    templateName: string;
    clientId: Types.ObjectId;
    clientName: string;
    clientEmail: string;
    overview?: string;
    /** One entry per selected service — title/description/items, for the order UI's scope-of-work display. */
    scopeOfWork: Array<{ title: string; description: string; items: string[] }>;
    /** Full per-service pricing breakdown (audit trail for finance). */
    services: IQuotationSnapshotService[];
    /** Monthly/yearly line items billed separately, excluded from grandTotal. */
    recurringCharges: IQuotationSnapshotLineItem[];
    currency: string;
    grandTotal: number;       // in original currency unit (not cents)
    discountAmount: number;
    taxAmount: number;
}

export interface IOrder extends Document {
    orderNumber: string;
    quotationGroupId: string;
    quotationSnapshot: IQuotationSnapshot;
    clientId: Types.ObjectId;
    orderType: OrderType;
    status: OrderStatus;
    statusHistory: IStatusHistory[];
    assignedTeam: Types.ObjectId[];
    teamLeader?: Types.ObjectId; // Designated supervisor Ref: Staff
    priority: 'low' | 'medium' | 'high' | 'urgent';
    internalNotes?: string;
    estimatedDeliveryDate?: Date;
    deliveredAt?: Date;
    completedAt?: Date;
    assets: IOrderAsset[];
    milestones: IOrderMilestone[];
    
    // Financial/Volume summary (redundant with snapshot for quick access)
    totalPrice: number;
    currency: string;
    imageQuantity: number;

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}


// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const assetSchema = new Schema<IOrderAsset>(
    {
        type: {
            type: String,
            enum: Object.values(AssetType),
            required: true,
        },
        label: { type: String, required: true },
        encryptedValue: { type: String, required: true },
        isLocked: { type: Boolean, default: true },
        accessToken: { type: String, select: false },    // never returned by default
        accessTokenExpiresAt: { type: Date },
        unlockedAt: { type: Date },
    },
    { _id: true },
);

const milestoneSchema = new Schema<IOrderMilestone>(
    {
        milestone: { type: String, required: true },
        completedAt: { type: Date, required: true },
        completedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        notes: { type: String },
    },
    { _id: false },
);

const snapshotLineItemSchema = {
    title: String,
    price: Number,
    billingCycle: { type: String, enum: ['one-time', 'monthly', 'yearly', 'per-image', 'per-video'] },
    quantity: { type: Number },
    description: String,
    _id: false,
};

const snapshotSchema = new Schema<IQuotationSnapshot>(
    {
        quotationId: { type: Schema.Types.ObjectId, required: true },
        quotationGroupId: { type: String, required: true },
        version: { type: Number, required: true },
        quotationNumber: { type: String, required: true },
        serviceType: { type: String, required: true },
        templateName: { type: String, required: true },
        clientId: { type: Schema.Types.ObjectId, required: true },
        clientName: { type: String, required: true },
        clientEmail: { type: String, required: true },
        overview: { type: String },
        scopeOfWork: [
            {
                title: String,
                description: String,
                items: [String],
                _id: false,
            },
        ],
        services: [
            {
                category: { type: String, required: true },
                scopeDescription: String,
                scopeItems: [String],
                basePrice: { type: Number, default: 0 },
                lineItems: [snapshotLineItemSchema],
                discount: { type: Number, default: 0 },
                taxRate: { type: Number, default: 0 },
                _id: false,
            },
        ],
        recurringCharges: [snapshotLineItemSchema],
        currency: { type: String, required: true },
        grandTotal: { type: Number, required: true },
        discountAmount: { type: Number, required: true },
        taxAmount: { type: Number, required: true },
    },
    { _id: false },
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const orderSchema = new Schema<IOrder>(
    {
        orderNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        /**
         * CRITICAL UNIQUENESS CONSTRAINT:
         * One quotation group may only ever produce ONE order.
         * This unique index is the DB-level enforcement of that rule.
         */
        quotationGroupId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        quotationSnapshot: {
            type: snapshotSchema,
            required: true,
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        orderType: {
            type: String,
            enum: Object.values(OrderType),
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: Object.values(OrderStatus),
            default: OrderStatus.PENDING,
            index: true,
        },
        statusHistory: [
            {
                status: { type: String, enum: Object.values(OrderStatus) },
                changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
                updatedAt: { type: Date, default: Date.now },
                note: String,
                _id: false,
            },
        ],
        assignedTeam: [{ type: Schema.Types.ObjectId, ref: 'Staff' }],
        teamLeader: { type: Schema.Types.ObjectId, ref: 'Staff', index: true },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium',
        },
        internalNotes: { type: String },
        estimatedDeliveryDate: { type: Date },
        deliveredAt: { type: Date },
        completedAt: { type: Date },
        assets: [assetSchema],
        milestones: [milestoneSchema],

        totalPrice: { type: Number, default: 0 },
        currency: { type: String, default: 'USD' },
        imageQuantity: { type: Number, default: 0 },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

    },
    {
        timestamps: true,
        optimisticConcurrency: true,
    },
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'quotationSnapshot.clientId': 1, status: 1 });

const OrderModel = model<IOrder>('Order', orderSchema);
export default OrderModel;
