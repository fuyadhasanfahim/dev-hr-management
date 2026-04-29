export type OrderStatus =
    | "pending"
    | "in_progress"
    | "quality_check"
    | "revision"
    | "completed"
    | "delivered"
    | "cancelled"
    // ── Quotation Pipeline Statuses (New) ───────────────────────────────
    | "pending_upfront"
    | "active"
    | "pending_delivery"
    | "pending_final";

export type OrderPriority = "low" | "normal" | "high" | "urgent";

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

export interface UpdateServiceInput extends Partial<CreateServiceInput> {}

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

export interface UpdateReturnFileFormatInput
    extends Partial<CreateReturnFileFormatInput> {}

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

export interface IOrder {
    _id: string;
    
    // ── Pipeline Fields (New) ───────────────────────────────────────────
    quotationGroupId?: string;
    quotationSnapshot?: any;
    assets?: IOrderAsset[];
    // ──────────────────────────────────────────────────────────────────

    title?: string; 
    description?: string;
    orderType?: string;
    currency?: string;
    totalAmount?: number;
    items?: IOrderItem[];

    orderName: string;
    clientId: Client | string;
    orderDate: string;
    deadline: string;
    originalDeadline?: string;
    imageQuantity: number;
    perImagePrice: number;
    totalPrice: number;
    services: {
        _id: string;
        name: string;
    }[];
    returnFileFormat: {
        _id: string;
        name: string;
        extension: string;
    };
    instruction?: string;
    status: OrderStatus;
    priority: OrderPriority;
    contactPersonId?: string;
    notes?: string;
    revisionCount: number;
    isLegacy?: boolean; 
    earning?: {
        status: "paid" | "unpaid";
    };
    revisionInstructions: IRevisionInstruction[];
    timeline: ITimelineEntry[];
    completedAt?: string;
    deliveredAt?: string;
    invoiceNumber?: string;
    isPaid?: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
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

export interface CreateOrderInput {
    orderName: string;
    clientId: string;
    orderDate: string;
    deadline: string;
    imageQuantity: number;
    perImagePrice: number;
    totalPrice: number;
    services: string[];
    returnFileFormat: string;
    instruction?: string;
    priority?: OrderPriority;
    contactPersonId?: string;
    notes?: string;
}

export interface UpdateOrderInput extends Partial<CreateOrderInput> {
    status?: OrderStatus;
}

export interface UpdateStatusInput {
    status: OrderStatus;
    note?: string;
    customEmailMessage?: string;
    downloadLink?: string;
    sendEmail?: boolean;
    selectedEmail?: string;
    selectedEmails?: string[];
}

export interface ExtendDeadlineInput {
    newDeadline: string;
    reason?: string;
}

export interface AddRevisionInput {
    instruction: string;
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
