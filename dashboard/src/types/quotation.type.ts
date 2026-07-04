export type ServiceType = "web-development";

export type QuotationCategory =
  | "web-development"
  | "photo-editing"
  | "marketing"
  | "video-editing";

export type QuotationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "superseded"
  | "expired"
  | "change_requested";

export interface IQuotationPhase {
  title: string;
  description?: string;
  items: string[];
  startDate?: string;
  endDate?: string;
}

export type BillingCycle =
  | "one-time"
  | "monthly"
  | "yearly"
  | "per-image"
  | "per-video";

export interface IAdditionalService {
  title: string;
  price: number; // for unit-based categories this is the UNIT price
  billingCycle: BillingCycle;
  /** Units for unit-based pricing (per-image / per-video). Absent ⇒ treated as 1. */
  quantity?: number;
  description?: string;
}

export interface IPaymentMilestone {
  label: string;
  percentage: number; // 0-100
  note?: string;
}

export interface QuotationData {
  _id?: string;
  quotationNumber?: string;
  quotationGroupId?: string;
  version?: number;
  isLatestVersion?: boolean;

  category: QuotationCategory;
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
    taxRate: number; // Percentage
    discount: number; // Percentage (0-100)
  };

  additionalServices: IAdditionalService[];
  workflow: string[];

  paymentMilestones?: IPaymentMilestone[];

  currency?: string;

  totals: {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    grandTotal: number;
  };

  status?: QuotationStatus;
  viewed?: boolean;
  secureToken?: string;
  tokenExpiresAt?: string;
  changeRequestReason?: string;
  orderId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
