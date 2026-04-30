import { Schema, model, Document, Types } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum OrderStatus {
    PENDING            = 'pending',           // Legacy/generic pending
    PENDING_UPFRONT    = 'pending_upfront',    // New: accepted, awaiting upfront payment
    ACTIVE             = 'active',            // New: upfront paid, project active
    IN_PROGRESS        = 'in_progress',       // team working
    QUALITY_CHECK      = 'quality_check',     // internal review
    REVISION           = 'revision',          // client requested changes
    PENDING_DELIVERY   = 'pending_delivery',   // New: staff triggered delivery, awaiting payment
    DELIVERED          = 'delivered',          // team marked delivered
    PENDING_FINAL      = 'pending_final',      // New: awaiting final payment
    AWAITING_APPROVAL  = 'awaiting_approval', // client notified
    APPROVED           = 'approved',           // client approved, delivery payment due
    COMPLETED          = 'completed',          // all payments done
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
    [OrderStatus.PENDING]:           [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
    [OrderStatus.PENDING_UPFRONT]:   [OrderStatus.ACTIVE, OrderStatus.CANCELLED],
    [OrderStatus.ACTIVE]:            [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
    [OrderStatus.IN_PROGRESS]:       [OrderStatus.QUALITY_CHECK, OrderStatus.REVISION, OrderStatus.CANCELLED],
    [OrderStatus.QUALITY_CHECK]:     [OrderStatus.PENDING_DELIVERY, OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.REVISION, OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
    [OrderStatus.REVISION]:          [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
    [OrderStatus.PENDING_DELIVERY]:  [OrderStatus.DELIVERED, OrderStatus.REVISION, OrderStatus.CANCELLED],
    [OrderStatus.DELIVERED]:         [OrderStatus.PENDING_FINAL, OrderStatus.COMPLETED, OrderStatus.REVISION, OrderStatus.CANCELLED],
    [OrderStatus.PENDING_FINAL]:     [OrderStatus.COMPLETED, OrderStatus.CANCELLED],


    [OrderStatus.AWAITING_APPROVAL]: [OrderStatus.APPROVED, OrderStatus.IN_PROGRESS],
    [OrderStatus.APPROVED]:          [OrderStatus.COMPLETED],
    [OrderStatus.COMPLETED]:         [OrderStatus.REVISION],
    [OrderStatus.CANCELLED]:         [OrderStatus.PENDING_UPFRONT],
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
    scopeOfWork: Array<{ title: string; description: string; items: string[] }>;
    currency: string;
    grandTotal: number;       // in original currency unit (not cents)
    taxRate: number;
    discount: number;
    additionalServicesTotal: number;
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
    priority: 'low' | 'medium' | 'high' | 'urgent';
    internalNotes?: string;
    estimatedDeliveryDate?: Date;
    deliveredAt?: Date;
    completedAt?: Date;
    assets: IOrderAsset[];
    milestones: IOrderMilestone[];
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
        currency: { type: String, required: true },
        grandTotal: { type: Number, required: true },
        taxRate: { type: Number, required: true },
        discount: { type: Number, required: true },
        additionalServicesTotal: { type: Number, required: true },
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
