import { Document, Types } from 'mongoose';

export type ServiceType = 'web-development' | 'product-photography';

export type QuotationStatus =
    | 'draft'
    | 'sent'
    | 'viewed'
    | 'change_requested'
    | 'accepted'
    | 'rejected'
    | 'expired'
    | 'superseded';

export interface IQuotationPhase {
    title: string;
    description?: string;
    items: string[]; // Checklist items
}

export interface IAdditionalService {
    title: string;
    price: number;
    billingCycle: 'one-time' | 'monthly' | 'yearly';
    description?: string;
}

export interface IQuotation extends Document {
    // ── Versioning ────────────────────────────────────────────────────────────
    quotationGroupId: string;
    version: number;
    isLatestVersion: boolean;

    // ── Identity ──────────────────────────────────────────────────────────────
    quotationNumber: string;
    serviceType: ServiceType;
    clientId: Types.ObjectId;

    // ── Snapshots ─────────────────────────────────────────────────────────────
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
        date: Date;
        validUntil: Date;
    };

    // ── Refactored Content (Strict Alignment) ──────────────────────────────────
    overview?: string;
    phases: IQuotationPhase[]; // Replaces separate feature arrays
    
    techStack: {
        frontend: string;
        backend: string;
        database: string;
        tools: string[];
    };

    pricing: {
        basePrice: number;
        taxRate: number;
        discount: number;
    };

    additionalServices: IAdditionalService[]; // Renamed from optionalServices
    workflow: string[];

    // ── Computed Totals ────────────────────────────────────────────────────────
    totals: {
        subtotal: number;
        taxAmount: number;
        grandTotal: number;
    };

    // ── Status & Metadata ──────────────────────────────────────────────────────
    status: QuotationStatus;
    secureToken?: string;
    tokenExpiresAt?: Date;
    orderId?: Types.ObjectId;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
