export type CatalogEntity = 'services' | 'platforms' | 'packages' | 'features' | 'sections';
/** Entities edited through the generic form dialog (sections have their own inline editors). */
export type FormEntity = Exclude<CatalogEntity, 'sections'>;
export type CatalogQuotationCategory = 'web-development' | 'photo-editing' | 'marketing' | 'video-editing';
export type CatalogFlowType = 'project' | 'retainer' | 'production';
export type CatalogBillingCycle = 'one-time' | 'monthly' | 'yearly' | 'per-image' | 'per-video' | 'per-second' | 'per-10s';

interface Base {
    _id: string;
    sortOrder: number;
    isActive: boolean;
}

export interface CatalogPlatform extends Base {
    serviceCount?: number;
    name: string;
    slug: string;
    description?: string;
    logo?: string;
    logoSecondary?: string;
    color?: string;
}

export interface CatalogPagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface CatalogService extends Base {
    /** Row counts, returned by the list endpoint only. */
    packageCount?: number;
    featureCount?: number;
    name: string;
    slug: string;
    description?: string;
    icon: string;
    quotationCategory: CatalogQuotationCategory;
    pricingMode: 'package' | 'unit';
    /** Wizard layout; missing on old records (see flowOf in lib/quotation-blueprint). */
    flowType?: CatalogFlowType;
    blueprint?: import('@/lib/quotation-blueprint').Blueprint | null;
    platformIds: string[];
}

export interface CatalogFeature extends Base {
    serviceId: string;
    platformId?: string | null;
    name: string;
    description?: string;
    group?: string;
    kind: 'included' | 'addon';
    price: number;
}

export interface CatalogPackage extends Base {
    serviceId: string;
    platformId?: string | null;
    name: string;
    slug: string;
    badge?: string;
    description?: string;
    price: number | null;
    priceMax?: number | null;
    billingCycle: CatalogBillingCycle;
    unitLabel?: string;
    bullets: string[];
    featureIds: string[];
    addonIds: string[];
    duration?: string;
    supportPeriod?: string;
    bestFor?: string;
    notes: string[];
    supportInclusions: string[];
    additionalCharges: string[];
    blueprint?: import('@/lib/quotation-blueprint').Blueprint | null;
}

export const TEXT_SECTION_KINDS = ['projectTitle', 'projectOverview', 'scopeOfWork', 'changeRequestNote', 'supportNote'] as const;
export const LIST_SECTION_KINDS = ['deliverables', 'optionalDeliverables', 'milestones', 'clientResponsibilities', 'requiredAssets', 'exclusions'] as const;
export const SECTION_KINDS = [...TEXT_SECTION_KINDS, ...LIST_SECTION_KINDS] as const;
export type CatalogSectionKind = (typeof SECTION_KINDS)[number];

export interface CatalogSectionItem {
    key: string;
    title: string;
    description?: string;
    /** Milestones: "3 weeks". */
    duration?: { value: number; unit: 'day' | 'week' | 'month' } | null;
}

/** Quotation content block: service-wide default (packageId = null) or a package override. */
export interface CatalogSection {
    _id: string;
    serviceId: string;
    packageId?: string | null;
    kind: CatalogSectionKind;
    items: CatalogSectionItem[];
    text?: string;
    sortOrder: number;
    isActive: boolean;
}

export interface CatalogGraph {
    services: CatalogService[];
    platforms: CatalogPlatform[];
    packages: CatalogPackage[];
    features: CatalogFeature[];
    sections: CatalogSection[];
    positions: Record<string, { x: number; y: number }>;
}

/** Shape returned by GET /catalog/tree — what the quotation wizard consumes. */
export interface CatalogTreePackage extends CatalogPackage {
    features: CatalogFeature[];
    addons: CatalogFeature[];
}
export interface CatalogTreeService extends CatalogService {
    platforms: CatalogPlatform[];
    sections: CatalogSection[];
    packages: CatalogTreePackage[];
}

export interface CatalogEntityMap {
    services: CatalogService;
    platforms: CatalogPlatform;
    packages: CatalogPackage;
    features: CatalogFeature;
    sections: CatalogSection;
}
