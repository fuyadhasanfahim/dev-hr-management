import { model, Schema, Types, type Document } from 'mongoose';

export const CATALOG_QUOTATION_CATEGORIES = ['web-development', 'photo-editing', 'marketing', 'video-editing'] as const;
export type CatalogQuotationCategory = (typeof CATALOG_QUOTATION_CATEGORIES)[number];

/**
 * How a service is quoted — decides which cards the quotation wizard shows.
 * project = milestones / revisions / support / hosting · retainer = monthly recurring ·
 * production = per-unit work (photo / video).
 */
export const CATALOG_FLOW_TYPES = ['project', 'retainer', 'production'] as const;
export type CatalogFlowType = (typeof CATALOG_FLOW_TYPES)[number];

/**
 * A top-level service category shown on the quotation "Services" step
 * ("Website Development", "Product Photography", …). `quotationCategory`
 * maps it onto the category enum the quotation/PDF pipeline already understands.
 */
export interface ICatalogService extends Document {
    name: string;
    slug: string;
    description?: string;
    /** Key into the dashboard icon registry. */
    icon: string;
    quotationCategory: CatalogQuotationCategory;
    /** 'package' = pick a package; 'unit' = per-unit rate × quantity (photo / video). */
    pricingMode: 'package' | 'unit';
    /** Wizard layout. Missing on old records — the dashboard infers it from pricingMode / category. */
    flowType?: CatalogFlowType;
    /** Service-wide quotation defaults; a package `blueprint` overrides it per key. See catalog-blueprint.ts. */
    blueprint?: Record<string, unknown> | null;
    /** Platforms offered for this service (ref CatalogPlatform). Empty = no platform step. */
    platformIds: Types.ObjectId[];
    sortOrder: number;
    isActive: boolean;
    createdBy?: Types.ObjectId;
}

const catalogServiceSchema = new Schema<ICatalogService>(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
        description: { type: String, trim: true },
        icon: { type: String, trim: true, default: 'website' },
        quotationCategory: { type: String, enum: CATALOG_QUOTATION_CATEGORIES, required: true },
        pricingMode: { type: String, enum: ['package', 'unit'], default: 'package' },
        flowType: { type: String, enum: CATALOG_FLOW_TYPES },
        blueprint: { type: Schema.Types.Mixed },
        platformIds: [{ type: Schema.Types.ObjectId, ref: 'CatalogPlatform' }],
        sortOrder: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true, index: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true },
);

export default model<ICatalogService>('CatalogService', catalogServiceSchema);
