import { Document, Types } from 'mongoose';

export type QuotationStatus =
    | 'draft'
    | 'sent'
    | 'viewed'
    | 'accepted'
    | 'change_requested'
    | 'rejected'
    | 'superseded'
    | 'expired';

export type BillingCycle =
    | 'one-time'
    | 'monthly'
    | 'yearly'
    | 'per-image'
    | 'per-video';

/** true for billing cycles paid upfront (once, or per delivered unit); false for ongoing/recurring cycles. */
export const isUpfrontBillingCycle = (cycle: BillingCycle): boolean =>
    cycle === 'one-time' || cycle === 'per-image' || cycle === 'per-video';

export interface IQuotationLineItem {
    title: string;
    price: number; // for unit-based cycles this is the UNIT price
    billingCycle: BillingCycle;
    /** Units for unit-based pricing (per-image / per-video). Absent ⇒ treated as 1. */
    quantity?: number;
    description?: string;
}

export interface IQuotationTechStack {
    description?: string;
    frontend: string[];
    backend: string[];
    database: string[];
    tools: string[];
}

export type QuotationCategory =
    | 'web-development'
    | 'photo-editing'
    | 'marketing'
    | 'video-editing';

export interface IQuotationService {
    category: QuotationCategory;
    scopeDescription?: string;
    scopeItems: string[];
    /** Only meaningful for the web-development category. */
    techStack?: IQuotationTechStack;
    basePrice: number;
    lineItems: IQuotationLineItem[];
    discount: number; // Percentage (0-100), applies to this service's one-time portion
    taxRate: number; // Percentage
}

export interface IPaymentMilestone {
    label: string;
    percentage: number; // 0-100
    note?: string;
}

export interface IQuotation extends Document {
    _id: Types.ObjectId;
    quotationNumber: string;
    quotationGroupId: string;
    version: number;
    isLatestVersion: boolean;

    serviceType: 'web-development';
    clientId: Types.ObjectId;

    company: {
        name: string;
        address?: string;
        email?: string;
        phone?: string;
        website?: string;
        logo?: string;
    };
    client: {
        contactName: string;
        companyName?: string;
        address?: string;
        email?: string;
        phone?: string;
    };
    details: {
        title: string;
        date: string;
        validUntil: string;
    };

    overview?: string;

    /** One entry per selected service — the single source of truth for scope, tech stack, and pricing. */
    services: IQuotationService[];

    notIncluded?: string[];
    clientRequirements?: string[];

    /** Monthly/yearly line items flattened out of services[].lineItems, billed separately from totals.grandTotal. */
    recurringCharges?: IQuotationLineItem[];

    workflow: string[];

    paymentMilestones?: IPaymentMilestone[];

    currency: string;

    /** Aggregate of every service's one-time/upfront portion. Recurring charges are excluded. */
    totals: {
        subtotal: number;
        discountAmount: number;
        taxAmount: number;
        grandTotal: number;
    };

    status: QuotationStatus;
    viewed?: boolean;
    secureToken?: string;
    tokenExpiresAt?: Date;
    changeRequestReason?: string;
    orderId?: Types.ObjectId;
    createdBy: Types.ObjectId;

    // Idempotency / provenance
    versionCreationKey?: string;
    /** Fingerprint of create payload to prevent rapid duplicates */
    creationFingerprint?: string;
    derivedFromQuotationId?: Types.ObjectId;
    __v: number;
    createdAt: Date;
    updatedAt: Date;
}
