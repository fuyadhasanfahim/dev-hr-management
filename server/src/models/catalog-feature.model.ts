import { model, Schema, Types, type Document } from 'mongoose';

/**
 * A single feature / deliverable. Scoped to a service (and optionally a
 * platform) so a feature is defined once and linked from every package that
 * includes it (CatalogPackage.featureIds / addonIds).
 */
export interface ICatalogFeature extends Document {
    serviceId: Types.ObjectId;
    platformId?: Types.ObjectId | null;
    name: string;
    description?: string;
    /** Heading it is listed under, e.g. "E-Commerce & Management". */
    group?: string;
    /** 'included' ships with a package; 'addon' is an optional paid extra. */
    kind: 'included' | 'addon';
    /** Only meaningful for add-ons. */
    price: number;
    sortOrder: number;
    isActive: boolean;
}

const catalogFeatureSchema = new Schema<ICatalogFeature>(
    {
        serviceId: { type: Schema.Types.ObjectId, ref: 'CatalogService', required: true, index: true },
        platformId: { type: Schema.Types.ObjectId, ref: 'CatalogPlatform', default: null, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        group: { type: String, trim: true },
        kind: { type: String, enum: ['included', 'addon'], default: 'included' },
        price: { type: Number, default: 0, min: 0 },
        sortOrder: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
);

catalogFeatureSchema.index({ serviceId: 1, platformId: 1, kind: 1, name: 1 }, { unique: true });

export default model<ICatalogFeature>('CatalogFeature', catalogFeatureSchema);
