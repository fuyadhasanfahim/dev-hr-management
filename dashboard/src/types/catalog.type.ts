export type CatalogEntity = 'services' | 'platforms' | 'packages' | 'features';
export type CatalogQuotationCategory = 'web-development' | 'photo-editing' | 'marketing' | 'video-editing';
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
}

/** Shape returned by GET /catalog/tree — what the quotation wizard consumes. */
export interface CatalogTreePackage extends CatalogPackage {
    features: CatalogFeature[];
    addons: CatalogFeature[];
}
export interface CatalogTreeService extends CatalogService {
    platforms: CatalogPlatform[];
    packages: CatalogTreePackage[];
}

export interface CatalogEntityMap {
    services: CatalogService;
    platforms: CatalogPlatform;
    packages: CatalogPackage;
    features: CatalogFeature;
}
