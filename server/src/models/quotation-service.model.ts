import { model, Schema, Document, Types } from 'mongoose';
import type { IQuotationService } from '../types/quotation.type.js';

export interface IQuotationServiceModel extends Omit<IQuotationService, 'lineItems'>, Document {
    quotationId: Types.ObjectId;
}

const techStackSchema = new Schema({
    description: { type: String },
    frontend: [{ type: String }],
    backend: [{ type: String }],
    database: [{ type: String }],
    tools: [{ type: String }],
}, { _id: false });

const quotationServiceSchema = new Schema<IQuotationServiceModel>(
    {
        quotationId: { type: Schema.Types.ObjectId, ref: 'Quotation', required: true, index: true },
        category: {
            type: String,
            enum: ['web-development', 'photo-editing', 'marketing', 'video-editing'],
            required: true,
        },
        // References into the quotation catalog (null for hand-built / legacy quotations).
        // The text fields below stay the immutable snapshot used by the PDF.
        catalogServiceId: { type: Schema.Types.ObjectId, ref: 'CatalogService', default: null },
        catalogPlatformId: { type: Schema.Types.ObjectId, ref: 'CatalogPlatform', default: null },
        catalogPackageId: { type: Schema.Types.ObjectId, ref: 'CatalogPackage', default: null },
        catalogFeatureIds: [{ type: Schema.Types.ObjectId, ref: 'CatalogFeature' }],
        scopeDescription: { type: String },
        scopeItems: [{ type: String }],
        techStack: techStackSchema,
        basePrice: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        taxRate: { type: Number, default: 0 },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual populate for line items belonging to this service
quotationServiceSchema.virtual('lineItems', {
    ref: 'QuotationLineItem',
    localField: '_id',
    foreignField: 'quotationServiceId',
});

const QuotationServiceModel = model<IQuotationServiceModel>('QuotationService', quotationServiceSchema);
export default QuotationServiceModel;
