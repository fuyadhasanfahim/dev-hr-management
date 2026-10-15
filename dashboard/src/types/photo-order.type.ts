export const PHOTO_STATUSES = ["pending", "in_progress", "quality_check", "revision", "ready_to_deliver", "completed", "delivered", "cancelled"] as const;
export type PhotoOrderStatus = (typeof PHOTO_STATUSES)[number];
export const PHOTO_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type PhotoOrderPriority = (typeof PHOTO_PRIORITIES)[number];

export const PHOTO_STATUS_LABELS: Record<PhotoOrderStatus, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    quality_check: "Quality Check",
    revision: "Revision",
    ready_to_deliver: "Ready to Deliver",
    completed: "Completed",
    delivered: "Delivered",
    cancelled: "Cancelled",
};
export const PHOTO_PRIORITY_LABELS: Record<PhotoOrderPriority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

/** Mirrors the server's workflow: which statuses an order can move to from each status. */
export const PHOTO_STATUS_WORKFLOW: Record<PhotoOrderStatus, PhotoOrderStatus[]> = {
    pending: ["in_progress", "cancelled"],
    in_progress: ["quality_check", "revision", "cancelled"],
    quality_check: ["ready_to_deliver", "revision", "in_progress"],
    revision: ["in_progress", "cancelled"],
    ready_to_deliver: ["completed", "revision"],
    completed: ["delivered", "revision"],
    delivered: [],
    cancelled: [],
};

export interface PhotoClientRef {
    _id: string;
    name: string;
    clientId?: string;
    emails?: string[];
    currency?: string;
    address?: string;
    teamMembers?: { _id?: string; name: string; email?: string }[];
}
export interface PhotoService {
    _id: string;
    name: string;
    description?: string;
    price: number;
    isActive: boolean;
}
export interface PhotoReturnFormat {
    _id: string;
    name: string;
    extension: string;
    description?: string;
    isActive: boolean;
}

export interface PhotoOrder {
    _id: string;
    orderName: string;
    clientId: PhotoClientRef;
    contactPersonId?: string;
    orderDate: string;
    deadline: string;
    originalDeadline?: string;
    imageQuantity: number;
    perImagePrice: number;
    totalPrice: number;
    services: Pick<PhotoService, "_id" | "name" | "price">[];
    returnFileFormat: Pick<PhotoReturnFormat, "_id" | "name" | "extension">;
    instruction?: string;
    notes?: string;
    status: PhotoOrderStatus;
    priority: PhotoOrderPriority;
    revisionCount: number;
    revisionInstructions: { instruction: string; createdAt: string }[];
    timeline: { status: PhotoOrderStatus; timestamp: string; note?: string }[];
    invoiceId?: string;
    invoiceNumber?: string;
    isPaid: boolean;
    createdAt: string;
}

export interface PhotoOrderInput {
    orderName: string;
    clientId: string;
    contactPersonId?: string;
    orderDate: string;
    deadline: string;
    imageQuantity: number;
    perImagePrice: number;
    totalPrice: number;
    services: string[];
    returnFileFormat: string;
    instruction?: string;
    notes?: string;
    priority: PhotoOrderPriority;
}

export interface PhotoOrderFilters {
    search?: string;
    status?: PhotoOrderStatus;
    priority?: PhotoOrderPriority;
    clientId?: string;
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
}

export interface PageMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface Paged<T> {
    data: T[];
    meta: PageMeta;
}

export interface PhotoInvoiceItem {
    orderId: string;
    orderName: string;
    date: string;
    images: number;
    unitPrice: number;
    amount: number;
}
export interface PhotoInvoice {
    _id: string;
    invoiceNumber: string;
    clientId: string | PhotoClientRef;
    client?: PhotoClientRef | null;
    month: number;
    year: number;
    currency: string;
    items: PhotoInvoiceItem[];
    totalImages: number;
    totalAmount: number;
    issueDate: string;
    dueDate: string;
    paymentStatus: "pending" | "paid";
    paidAt?: string;
    emailedTo: string[];
    paymentUrl?: string;
}
export interface InvoiceClientRow {
    client: PhotoClientRef;
    orders: number;
    uninvoiced: number;
    images: number;
}
