import { model, Schema, Document, Types } from 'mongoose';
import type { IPaymentMilestone } from '../types/quotation.type.js';

export interface IQuotationMilestoneModel extends IPaymentMilestone, Document {
    quotationId: Types.ObjectId;
}

const quotationMilestoneSchema = new Schema<IQuotationMilestoneModel>(
    {
        quotationId: { type: Schema.Types.ObjectId, ref: 'Quotation', required: true, index: true },
        label: { type: String, required: true },
        percentage: { type: Number, required: true, min: 0, max: 100 },
        note: { type: String },
    },
    {
        timestamps: true,
    }
);

const QuotationMilestoneModel = model<IQuotationMilestoneModel>('QuotationMilestone', quotationMilestoneSchema);
export default QuotationMilestoneModel;
