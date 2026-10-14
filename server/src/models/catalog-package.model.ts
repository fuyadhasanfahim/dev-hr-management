import { model, Schema, Types, type Document } from 'mongoose';

export const CATALOG_BILLING_CYCLES = ['one-time', 'monthly', 'yearly', 'per-image', 'per-video', 'per-second', 'per-10s'] as const;
export type CatalogBillingCycle = (typeof CATALOG_BILLING_CYCLES)[number];

/** A sellable package of a service (optionally on a specific platform). */
export interface ICatalogPackage extends Document {
    serviceId: Types.ObjectId;
    platformId?: Types.ObjectId | null;
    name: string;
    slug: string;
    badge?: string;
    description?: string;
    /** null = custom quote (price entered per quotation). */
    price: number | null;
    /** Upper bound for ranged unit prices (e.g. BDT 300–600 / product). */
    priceMax?: number | null;
    billingCycle: CatalogBillingCycle;
    /** Noun for unit pricing ("product", "reel", "video"). */
    unitLabel?: string;
    bullets: string[];
    featureIds: Types.ObjectId[];
    addonIds: Types.ObjectId[];
    duration?: string;
    supportPeriod?: string;
    bestFor?: string;
    /** Policy notes shown with the package (e.g. design policy). */
    notes: string[];
    /** Pre-fill for the Terms step. */
    supportInclusions: string[];
    additionalCharges: string[];
    /** Per-package overrides of the service blueprint (inclusions, revisions, payment milestones, policies). */
    blueprint?: Record<string, unknown> | null;
    sortOrder: number;
    isActive: boolean;
}

const catalogPackageSchema = new Schema<ICatalogPackage>(
    {
        serviceId: { type: Schema.Types.ObjectId, ref: 'CatalogService', required: true, index: true },
        platformId: { type: Schema.Types.ObjectId, ref: 'CatalogPlatform', default: null, index: true },
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true, lowercase: true },
        badge: { type: String, trim: true },
        description: { type: String, trim: true },
        price: { type: Number, default: null, min: 0 },
        priceMax: { type: Number, default: null, min: 0 },
        billingCycle: { type: String, enum: CATALOG_BILLING_CYCLES, default: 'one-time' },
        unitLabel: { type: String, trim: true },
        bullets: [{ type: String, trim: true }],
        featureIds: [{ type: Schema.Types.ObjectId, ref: 'CatalogFeature' }],
        addonIds: [{ type: Schema.Types.ObjectId, ref: 'CatalogFeature' }],
        duration: { type: String, trim: true },
        supportPeriod: { type: String, trim: true },
        bestFor: { type: String, trim: true },
        notes: [{ type: String, trim: true }],
        supportInclusions: [{ type: String, trim: true }],
        additionalCharges: [{ type: String, trim: true }],
        blueprint: { type: Schema.Types.Mixed },
        sortOrder: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true },
);

catalogPackageSchema.index({ serviceId: 1, platformId: 1, slug: 1 }, { unique: true });

export default model<ICatalogPackage>('CatalogPackage', catalogPackageSchema);
