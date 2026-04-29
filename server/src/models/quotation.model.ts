import { model, Schema } from 'mongoose';
import type { IQuotation } from '../types/quotation.type.js';

const phaseSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    items: [{ type: String }],
}, { _id: false });

const serviceSchema = new Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    billingCycle: { type: String, enum: ['one-time', 'monthly', 'yearly'], default: 'one-time' },
    description: { type: String },
}, { _id: false });

const paymentMilestoneSchema = new Schema({
    label: { type: String, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    note: { type: String },
}, { _id: false });

const quotationSchema = new Schema<IQuotation>(
    {
        // ── Versioning ────────────────────────────────────────────────────────────
        quotationGroupId: { type: String, required: true, index: true },
        version: { type: Number, required: true, min: 1, default: 1 },
        isLatestVersion: { type: Boolean, required: true, default: true, index: true },

        // ── Identity ──────────────────────────────────────────────────────────────
        quotationNumber: { type: String, required: true, unique: true, index: true },
        serviceType: { type: String, enum: ['web-development'], required: true },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },

        // ── Snapshots ─────────────────────────────────────────────────────────────
        company: {
            name: { type: String, required: true },
            address: String, email: String, phone: String, website: String, logo: String,
        },
        client: {
            contactName: { type: String, required: true },
            companyName: String, address: String, email: String, phone: String,
        },
        details: {
            title: { type: String, required: true },
            date: { type: Date, required: true },
            validUntil: { type: Date, required: true },
        },

        // ── Refactored Content ─────────────────────────────────────────────────────
        overview: String,
        phases: [phaseSchema],
        
        techStack: {
            frontend: { type: String, default: '' },
            backend: { type: String, default: '' },
            database: { type: String, default: '' },
            tools: [{ type: String }],
        },

        pricing: {
            basePrice: { type: Number, default: 0 },
            taxRate: { type: Number, default: 0 },
            discount: { type: Number, default: 0 },
        },

        additionalServices: [serviceSchema],
        workflow: [{ type: String }],

        paymentMilestones: { type: [paymentMilestoneSchema], default: undefined },

        // ── Currency snapshot (used in PDF/UI/events) ────────────────────────────
        currency: { type: String, default: '৳' },

        totals: {
            subtotal: { type: Number, default: 0 },
            taxAmount: { type: Number, default: 0 },
            grandTotal: { type: Number, default: 0 },
        },

        // ── Status ────────────────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ['draft', 'sent', 'viewed', 'change_requested', 'accepted', 'rejected', 'expired', 'superseded'],
            default: 'draft',
            index: true,
        },

        secureToken: { type: String, sparse: true, index: true },
        tokenExpiresAt: Date,
        changeRequestReason: String,
        orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        // ── Idempotency / Provenance ─────────────────────────────────────────────
        // Used to make createNewVersion safe to retry (and safe under concurrency).
        versionCreationKey: { type: String, sparse: true, index: true },
        derivedFromQuotationId: { type: Schema.Types.ObjectId, ref: 'Quotation', sparse: true, index: true },
    },
    {
        timestamps: true,
        optimisticConcurrency: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

quotationSchema.index({ quotationGroupId: 1, version: -1 });
quotationSchema.index({ quotationGroupId: 1, versionCreationKey: 1 }, { unique: true, sparse: true });

quotationSchema.virtual('viewed').get(function (this: IQuotation) {
    return this.status !== 'draft' && this.status !== 'sent';
});

const QuotationModel = model<IQuotation>('Quotation', quotationSchema);
export default QuotationModel;
