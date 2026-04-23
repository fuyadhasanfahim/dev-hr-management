import { Document, Types } from 'mongoose';

export type ServiceType = 'web-development' | 'product-photography';
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface IScopePhase {
    id: string;
    title: string;
    description: string;
    items: string[];
}

export interface IOptionalService {
    id: string;
    title: string;
    price: number;
    description: string;
    items: string[];
    type: 'recurring' | 'one-time';
}

export interface IPhotographyItem {
    id: string;
    title: string;
    outputString: string;
    quantity: number;
    price: number;
}

export interface IQuotation extends Document {
    quotationNumber: string;
    serviceType: ServiceType;
    clientId: Types.ObjectId;
    
    // Snapshot of business details at the time of quotation
    company: {
        name: string;
        address: string;
        email: string;
        phone: string;
        website: string;
        logo?: string;
    };

    // Snapshot of client details at the time of quotation
    client: {
        contactName: string;
        companyName: string;
        address: string;
        email: string;
        phone: string;
    };

    details: {
        title: string;
        date: Date;
        validUntil: Date;
    };

    overview: string;
    scopeOfWork: IScopePhase[];
    techStack: {
        frontend: string[];
        backend: string[];
        tools: string[];
        database: string[];
    };
    features: string[];
    adminFeatures: string[];
    marketingSetup: string[];
    deliveryTimeline: string;

    pricing: {
        totalCost: number;
        included: string[];
        notIncluded: string[];
    };

    optionalServices: IOptionalService[];
    photographyItems: IPhotographyItem[];

    workflow: string[];
    finalNote: string;

    settings: {
        currency: string;
        taxRate: number;
        discount: number;
    };

    totals: {
        packagePrice: number;
        additionalTotal: number;
        taxAmount: number;
        grandTotal: number;
    };

    status: QuotationStatus;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
