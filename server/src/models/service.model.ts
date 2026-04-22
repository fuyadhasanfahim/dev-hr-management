import { Schema, model, Document } from 'mongoose';

export enum PricingModel {
    FIXED = 'fixed',
    HOURLY = 'hourly',
    MILESTONE = 'milestone'
}

export enum ServiceCategory {
    WEB_DESIGN = 'web-design',
    WEB_DEV = 'web-dev',
    MAINTENANCE = 'maintenance',
    SEO = 'seo',
    CUSTOM = 'custom'
}

export interface IService extends Document {
    name: string;
    category: ServiceCategory;
    pricingModel: PricingModel;
    basePrice: number;
    currency: string;
    description?: string;
    isActive: boolean;
}

const serviceSchema = new Schema<IService>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        category: {
            type: String,
            enum: Object.values(ServiceCategory),
            required: true,
            index: true,
        },
        pricingModel: {
            type: String,
            enum: Object.values(PricingModel),
            required: true,
        },
        basePrice: {
            type: Number,
            default: 0,
        },
        currency: {
            type: String,
            default: 'USD',
            uppercase: true,
        },
        description: {
            type: String,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    { timestamps: true },
);

const ServiceModel = model<IService>('Service', serviceSchema);
export default ServiceModel;
