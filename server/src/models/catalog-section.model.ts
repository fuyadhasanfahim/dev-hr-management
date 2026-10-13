import { model, Schema, Types, type Document } from 'mongoose';

/** Text sections hold one block of copy; list sections hold ordered items. */
export const CATALOG_TEXT_KINDS = ['projectTitle', 'projectOverview', 'scopeOfWork', 'changeRequestNote', 'supportNote'] as const;
export const CATALOG_LIST_KINDS = ['deliverables', 'optionalDeliverables', 'milestones', 'clientResponsibilities', 'requiredAssets', 'exclusions'] as const;
export const CATALOG_SECTION_KINDS = [...CATALOG_TEXT_KINDS, ...CATALOG_LIST_KINDS] as const;
export type CatalogSectionKind = (typeof CATALOG_SECTION_KINDS)[number];

export const DURATION_UNITS = ['day', 'week', 'month'] as const;

export interface ICatalogSectionItem {
    /** Stable client-side key so drag/edit/undo can address an item without relying on its index. */
    key: string;
    title: string;
    description?: string;
    /** Milestones only: "3 weeks". */
    duration?: { value: number; unit: (typeof DURATION_UNITS)[number] } | null;
}

/**
 * A reusable block of quotation content — deliverables, milestones & timeline,
 * client responsibilities, required assets, exclusions, notes …
 *
 * Scope = service (+ optional package). `packageId = null` is the service-wide
 * default; a package-level section OVERRIDES it for that package
 * (resolution: package → service). One section per (service, package, kind).
 */
export interface ICatalogSection extends Document {
    serviceId: Types.ObjectId;
    packageId?: Types.ObjectId | null;
    kind: CatalogSectionKind;
    items: ICatalogSectionItem[];
    text?: string;
    sortOrder: number;
    isActive: boolean;
}

const itemSchema = new Schema<ICatalogSectionItem>(
    {
        key: { type: String, required: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        duration: {
            type: new Schema({ value: { type: Number, min: 0 }, unit: { type: String, enum: DURATION_UNITS } }, { _id: false }),
            default: null,
        },
    },
    { _id: false },
);

const catalogSectionSchema = new Schema<ICatalogSection>(
    {
        serviceId: { type: Schema.Types.ObjectId, ref: 'CatalogService', required: true, index: true },
        packageId: { type: Schema.Types.ObjectId, ref: 'CatalogPackage', default: null, index: true },
        kind: { type: String, enum: CATALOG_SECTION_KINDS, required: true },
        items: { type: [itemSchema], default: [] },
        text: { type: String, default: '' },
        sortOrder: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
);

catalogSectionSchema.index({ serviceId: 1, packageId: 1, kind: 1 }, { unique: true });

export default model<ICatalogSection>('CatalogSection', catalogSectionSchema);
