import { model, Schema } from 'mongoose';
import type { IQuotation } from '../types/quotation.type.js';

const quotationSchema = new Schema<IQuotation>(
    {
        quotationNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        serviceType: {
            type: String,
            enum: ['web-development', 'product-photography'],
            required: true,
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
        },
        company: {
            name: { type: String, required: true },
            address: { type: String },
            email: { type: String },
            phone: { type: String },
            website: { type: String },
            logo: { type: String },
        },
        client: {
            contactName: { type: String, required: true },
            companyName: { type: String },
            address: { type: String },
            email: { type: String },
            phone: { type: String },
        },
        details: {
            title: { type: String, required: true },
            date: { type: Date, required: true },
            validUntil: { type: Date, required: true },
        },
        overview: { type: String },
        scopeOfWork: [
            {
                id: String,
                title: String,
                description: String,
                items: [String],
            },
        ],
        techStack: {
            frontend: [String],
            backend: [String],
            tools: [String],
            database: [String],
        },
        features: [String],
        adminFeatures: [String],
        marketingSetup: [String],
        deliveryTimeline: { type: String },
        pricing: {
            totalCost: { type: Number, default: 0 },
            included: [String],
            notIncluded: [String],
        },
        optionalServices: [
            {
                id: String,
                title: String,
                price: Number,
                description: String,
                items: [String],
                type: { type: String, enum: ['recurring', 'one-time'] },
            },
        ],
        photographyItems: [
            {
                id: String,
                title: String,
                outputString: String,
                quantity: Number,
                price: Number,
            },
        ],
        workflow: [String],
        finalNote: { type: String },
        settings: {
            currency: { type: String, default: '৳' },
            taxRate: { type: Number, default: 0 },
            discount: { type: Number, default: 0 },
        },
        totals: {
            packagePrice: { type: Number, required: true },
            additionalTotal: { type: Number, required: true },
            taxAmount: { type: Number, required: true },
            grandTotal: { type: Number, required: true },
        },
        status: {
            type: String,
            enum: ['draft', 'sent', 'accepted', 'rejected'],
            default: 'draft',
            index: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

const QuotationModel = model<IQuotation>('Quotation', quotationSchema);
export default QuotationModel;
