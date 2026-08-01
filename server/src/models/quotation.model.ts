import { model, Schema } from 'mongoose';
import type { IQuotation } from '../types/quotation.type.js';

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

        overview: String,

        notIncluded: [{ type: String }],
        clientRequirements: [{ type: String }],
        includedSupport: [{ type: String }],
        keyTerms: [{ type: String }],

        workflow: [{ type: String }],

        // ── Currency snapshot (used in PDF/UI/events) ────────────────────────────
        currency: { type: String, default: '৳' },

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
        versionCreationKey: { type: String, sparse: true, index: true },
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

// ── Virtual Relations ────────────────────────────────────────────────────────
quotationSchema.virtual('services', {
    ref: 'QuotationService',
    localField: '_id',
    foreignField: 'quotationId',
});

quotationSchema.virtual('recurringCharges', {
    ref: 'QuotationLineItem',
    localField: '_id',
    foreignField: 'quotationId',
    match: { quotationServiceId: { $exists: false } }, // Top-level recurring charges don't have a serviceId
});

quotationSchema.virtual('paymentMilestones', {
    ref: 'QuotationMilestone',
    localField: '_id',
    foreignField: 'quotationId',
});

const QuotationModel = model<IQuotation>('Quotation', quotationSchema);
export default QuotationModel;
