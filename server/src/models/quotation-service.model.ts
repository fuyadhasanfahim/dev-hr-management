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
