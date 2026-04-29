export type ServiceType = "web-development" | "product-photography";

export type QuotationStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "superseded"
  | "expired"
  | "change_requested";

export interface IQuotationPhase {
  title: string;
  description?: string;
  items: string[];
}

export interface IAdditionalService {
  title: string;
  price: number;
  billingCycle: "one-time" | "monthly" | "yearly";
  description?: string;
}

export interface QuotationData {
  _id?: string;
  quotationNumber?: string;
  quotationGroupId?: string;
  version?: number;
  isLatestVersion?: boolean;

  serviceType: ServiceType;
  clientId: string;

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

  // ── Unified Content ───────────────────────────────────────────────────
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
    taxRate: number;
    discount: number;
  };

  additionalServices: IAdditionalService[];
  workflow: string[];

  totals: {
    subtotal: number;
    taxAmount: number;
    grandTotal: number;
  };

  status?: QuotationStatus;
  orderId?: string;
  createdAt?: string;
  updatedAt?: string;
}
