import { model, Schema } from 'mongoose';
import type { IQuotation } from '../types/quotation.type.js';

const lineItemSchema = new Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    billingCycle: {
        type: String,
        enum: ['one-time', 'monthly', 'yearly', 'per-image', 'per-video', 'per-second', 'per-10s'],
        default: 'one-time',
    },
    // Units for unit-based line items (per-image / per-video). Absent ⇒ treated
    // as 1 by totals, so one-time line items stay byte-identical.
    quantity: { type: Number },
    description: { type: String },
}, { _id: false });

const techStackSchema = new Schema({
    description: { type: String },
    frontend: [{ type: String }],
    backend: [{ type: String }],
    database: [{ type: String }],
    tools: [{ type: String }],
}, { _id: false });

const quotationServiceSchema = new Schema({
    category: {
        type: String,
        enum: ['web-development', 'photo-editing', 'marketing', 'video-editing'],
        required: true,
    },
    scopeDescription: { type: String },
    scopeItems: [{ type: String }],
    // Only meaningful for the web-development category; absent for others.
    techStack: techStackSchema,
    basePrice: { type: Number, default: 0 },
    lineItems: [lineItemSchema],
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
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

        // ── Multi-service content & pricing ──────────────────────────────────────
        // One entry per selected service (web-development / marketing / photo-editing
        // / video-editing). Each service owns its own scope, pricing, and (for
        // web-development) tech stack — this is the single source of truth that
        // replaced the old flat category/pricing/additionalServices/phases/techStack.
        services: { type: [quotationServiceSchema], default: [] },

        overview: String,

        notIncluded: [{ type: String }],
        clientRequirements: [{ type: String }],

        // Monthly/yearly line items flattened out of `services[].lineItems`, kept
        // separate from `totals` since they're billed on an ongoing basis and are
        // not part of the upfront/milestone-based grand total.
        recurringCharges: [lineItemSchema],

        workflow: [{ type: String }],

        paymentMilestones: { type: [paymentMilestoneSchema], default: undefined },

        // ── Currency snapshot (used in PDF/UI/events) ────────────────────────────
        currency: { type: String, default: '৳' },

        // Aggregate of every service's one-time/upfront portion (see quotation.service.ts
        // calculateTotals()). Recurring charges are intentionally excluded.
        totals: {
            subtotal: { type: Number, default: 0 },
            discountAmount: { type: Number, default: 0 },
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
        // Used to prevent rapid duplicate creations (same payload within a time window).
        creationFingerprint: { type: String, sparse: true, index: true },
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
quotationSchema.index({ createdBy: 1, creationFingerprint: 1, createdAt: -1 });

quotationSchema.virtual('viewed').get(function (this: IQuotation) {
    return this.status !== 'draft' && this.status !== 'sent';
});

const QuotationModel = model<IQuotation>('Quotation', quotationSchema);
export default QuotationModel;
