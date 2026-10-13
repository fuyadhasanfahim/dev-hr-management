import { model, Schema, Types, type Document } from 'mongoose';

/** A technology a service can be built on (Laravel, Shopify, …). Reused across services via CatalogService.platformIds. */
export interface ICatalogPlatform extends Document {
    name: string;
    slug: string;
    description?: string;
    /** Brand glyph key served from dashboard /assets/tech/<logo>.svg (empty = generic code icon). */
    logo?: string;
    logoSecondary?: string;
    color?: string;
    sortOrder: number;
    isActive: boolean;
    createdBy?: Types.ObjectId;
}

const catalogPlatformSchema = new Schema<ICatalogPlatform>(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
        description: { type: String, trim: true },
        logo: { type: String, trim: true, default: '' },
        logoSecondary: { type: String, trim: true, default: '' },
        color: { type: String, trim: true, default: 'currentColor' },
        sortOrder: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true, index: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true },
);

export default model<ICatalogPlatform>('CatalogPlatform', catalogPlatformSchema);
