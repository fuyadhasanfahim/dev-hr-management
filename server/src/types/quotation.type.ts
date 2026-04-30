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

export interface IQuotationPhase {
    title: string;
    description?: string;
    items: string[];
    startDate?: string;
    endDate?: string;
}

export interface IAdditionalService {
    title: string;
    price: number;
    billingCycle: 'one-time' | 'monthly' | 'yearly';
    description?: string;
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
    phases: IQuotationPhase[];
    
    techStack: {
        frontend: string;
        backend: string;
        database: string;
        tools: string[];
    };

    pricing: {
        basePrice: number;
        taxRate: number; // Percentage
        discount: number; // Percentage (0-100)
    };

    additionalServices: IAdditionalService[];
    workflow: string[];

    paymentMilestones?: IPaymentMilestone[];

    currency: string;

    totals: {
        subtotal: number;
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
    createdAt: Date;
    updatedAt: Date;
}
