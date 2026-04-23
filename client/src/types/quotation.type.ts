export type ServiceType = "web-development" | "product-photography";

export interface CompanyDetails {
  logo?: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
}

export interface ClientDetails {
  contactName: string;
  companyName: string;
  address: string;
  email: string;
  phone: string;
}

export interface QuotationDetails {
  title: string;
  quotationNumber: string;
  date: string;
  validUntil: string;
}

export interface ScopePhase {
  id: string;
  title: string;
  description: string;
  items: string[];
}

export interface TechStack {
  frontend: string[];
  backend: string[];
  tools: string[];
  database: string[];
}

export interface Settings {
  currency: "$" | "৳" | "€" | "£";
  taxRate: number;
  discount: number;
}

export interface OptionalService {
  id: string;
  title: string;
  price: number;
  description: string;
  items: string[];
  type: "recurring" | "one-time";
}

export interface PhotographyItem {
  id: string;
  title: string;
  outputString: string;
  quantity: number;
  price: number;
}

export interface QuotationData {
  serviceType: ServiceType;
  company: CompanyDetails;
  client: ClientDetails;
  details: QuotationDetails;

  overview: string;
  scopeOfWork: ScopePhase[];
  techStack: TechStack;
  features: string[];
  adminFeatures: string[];
  marketingSetup: string[];
  deliveryTimeline: string;

  pricing: {
    totalCost: number;
    included: string[];
    notIncluded: string[];
  };

  optionalServices: OptionalService[];
  photographyItems: PhotographyItem[];

  workflow: string[];
  finalNote: string;

  settings: Settings;
}
