export type OrderStatus =
    | "pending"
    | "in_progress"
    | "revision"
    | "completed"
    | "delivered"
    | "cancelled";

// Server writes low | medium | high | urgent. "normal" is legacy read-only.
export type OrderPriority = "low" | "normal" | "medium" | "high" | "urgent";

export interface IService {
    _id: string;
    name: string;
    category?: string;
    pricingModel?: 'fixed' | 'hourly' | 'milestone';
    basePrice?: number;
    hourlyRate?: number;
    milestoneNotes?: string;
    description?: string;
    isActive: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateServiceInput {
    name: string;
    category?: string;
    pricingModel?: 'fixed' | 'hourly' | 'milestone';
    basePrice?: number;
    hourlyRate?: number;
    milestoneNotes?: string;
    description?: string;
    isActive?: boolean;
}

export type UpdateServiceInput = Partial<CreateServiceInput>;

export interface IReturnFileFormat {
    _id: string;
    name: string;
    extension: string;
    description?: string;
    isActive: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateReturnFileFormatInput {
    name: string;
    extension: string;
    description?: string;
    isActive?: boolean;
}

export type UpdateReturnFileFormatInput = Partial<CreateReturnFileFormatInput>;

export interface IRevisionInstruction {
    instruction: string;
    createdAt: string;
    createdBy: string;
}

export interface ITimelineEntry {
    status: OrderStatus;
    timestamp: string;
    changedBy: string;
    note?: string;
}

export interface IOrderItem {
    serviceId?: string;
    name: string;
    pricingModel: string;
    quantity?: number;
    hours?: number;
    unitPrice: number;
    totalPrice: number;
}

import { Client } from "./client.type";

export interface IOrderAsset {
    id: string;
    name: string;
    url: string;
    isLocked: boolean;
}

export interface IQuotationSnapshotLineItem {
    title: string;
    price: number;
    billingCycle: 'one-time' | 'monthly' | 'yearly' | 'per-image' | 'per-video' | 'per-second' | 'per-10s';
    quantity?: number;
    description?: string;
}

export interface IQuotationSnapshotService {
    category: string;
    scopeDescription?: string;
    scopeItems: string[];
    basePrice: number;
    lineItems: IQuotationSnapshotLineItem[];
    discount: number;
    taxRate: number;
}

export interface IQuotationSnapshotMilestone {
    label: string;
    percentage: number;
    note?: string;
}

export interface IQuotationSnapshot {
    quotationId: string;
    quotationGroupId: string;
    version: number;
    quotationNumber: string;
    serviceType: string;
    templateName?: string;
    clientId: string;
    clientName: string;
    clientEmail: string;
    overview?: string;
    details?: {
        title: string;
        date: string;
        validUntil: string;
    };
    scopeOfWork: Array<{ title: string; description: string; items: string[] }>;
    services?: IQuotationSnapshotService[];
    recurringCharges?: IQuotationSnapshotLineItem[];
    paymentMilestones?: IQuotationSnapshotMilestone[];
    notIncluded?: string[];
    clientRequirements?: string[];
    workflow?: string[];
    currency: string;
    grandTotal: number;
    discountAmount: number;
    taxAmount: number;
    totals?: {
        subtotal: number;
        discountAmount: number;
        taxAmount: number;
        grandTotal: number;
    };
}

export type OrderType = "project" | "service" | "subscription";

export interface IOrderStatusHistoryEntry {
    status: OrderStatus;
    note?: string;
    changedBy?: string | { _id: string; name: string };
    updatedAt?: string;
    createdAt?: string;
}

export type OrderStaffRef = string | { _id: string; name: string; image?: string };

/**
 * An order is the immutable operational record created when a quotation is
 * accepted. `quotationSnapshot` is a frozen copy of the quotation (scope,
 * services, line items, milestones, totals) — the source of truth for every
 * financial / scope decision. Everything else is operational and mutable.
 */
export interface IOrder {
    _id: string;
    orderNumber: string;

    // ── Frozen quotation snapshot (source of truth) ────────────────────
    quotationGroupId?: string;
    quotationSnapshot?: IQuotationSnapshot;

    // ── Operational ───────────────────────────────────────────────────
    clientId: Client | string;
    orderType?: OrderType;
    status: OrderStatus;
    priority: OrderPriority;
    statusHistory?: IOrderStatusHistoryEntry[];
    assignedTeam?: OrderStaffRef[];
    teamLeader?: OrderStaffRef | null;
    assets?: IOrderAsset[];
    milestones?: unknown[];
    internalNotes?: string;
    estimatedDeliveryDate?: string;
    completedAt?: string;
    deliveredAt?: string;

    // ── Quick-access financial summary (mirrors the snapshot) ─────────
    totalPrice: number;
    currency?: string;
    imageQuantity?: number;

    createdBy: string;
    createdAt: string;
    updatedAt: string;

    // ── Legacy image-editing fields — no longer written by the backend.
    // Kept optional so the invoice / dashboard / order-history views still
    // compile until they are migrated to `quotationSnapshot`. @deprecated
    orderName?: string;
    orderDate?: string;
    deadline?: string;
    originalDeadline?: string;
    perImagePrice?: number;
    title?: string;
    description?: string;
    totalAmount?: number;
    items?: IOrderItem[];
    services?: { _id: string; name: string }[];
    returnFileFormat?: { _id: string; name: string; extension: string };
    instruction?: string;
    notes?: string;
    contactPersonId?: string;
    revisionCount?: number;
    isLegacy?: boolean;
    earning?: { status: "paid" | "unpaid" };
    revisionInstructions?: IRevisionInstruction[];
    timeline?: ITimelineEntry[];
    invoiceNumber?: string;
    isPaid?: boolean;
    paymentPhases?: {
        totalPercentage?: number;
        upfront: { status: string; amountDue?: number; amountPaid?: number; percentage?: number };
        delivery: { status: string; amountDue?: number; amountPaid?: number; percentage?: number };
        final: { status: string; amountDue?: number; amountPaid?: number; percentage?: number };
    } | null;
}

export interface IOrderStats {
    total: number;
    pending: number;
    inProgress: number;
    qualityCheck: number;
    revision: number;
    completed: number;
    delivered: number;
    overdue: number;
}

export interface UpdateStatusInput {
    status: OrderStatus;
    note?: string;
}

/** Operational fields an order editor may change. The quotation snapshot is immutable. */
export interface UpdateOrderInput {
    priority?: OrderPriority;
    internalNotes?: string;
    estimatedDeliveryDate?: string | null;
}

export interface OrderFilters {
    clientId?: string;
    status?: OrderStatus;
    priority?: OrderPriority;
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
    search?: string;
    page?: number;
    limit?: number;
}
