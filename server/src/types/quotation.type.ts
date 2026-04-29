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

export interface IQuotation extends Document {
    _id: Types.ObjectId;
    quotationNumber: string;
    quotationGroupId: string;
    version: number;
    isLatestVersion: boolean;
    
    serviceType: 'web-development' | 'product-photography';
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
        discount: number; // Percentage
    };

    additionalServices: IAdditionalService[];
    workflow: string[];

    totals: {
        subtotal: number;
        taxAmount: number;
        grandTotal: number;
    };

    status: QuotationStatus;
    secureToken?: string;
    tokenExpiresAt?: Date;
    changeRequestReason?: string;
    orderId?: Types.ObjectId;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
