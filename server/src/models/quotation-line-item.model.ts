import { model, Schema, Document, Types } from 'mongoose';
import type { IQuotationLineItem } from '../types/quotation.type.js';

export interface IQuotationLineItemModel extends IQuotationLineItem, Document {
    quotationId: Types.ObjectId;
    quotationServiceId?: Types.ObjectId; // Nullable for top-level recurring charges
}

const quotationLineItemSchema = new Schema<IQuotationLineItemModel>(
    {
        quotationId: { type: Schema.Types.ObjectId, ref: 'Quotation', required: true, index: true },
        quotationServiceId: { type: Schema.Types.ObjectId, ref: 'QuotationService', index: true },
        title: { type: String, required: true },
        price: { type: Number, required: true },
        billingCycle: {
            type: String,
            enum: ['one-time', 'monthly', 'yearly', 'per-image', 'per-video', 'per-second', 'per-10s'],
            default: 'one-time',
        },
        quantity: { type: Number },
        description: { type: String },
    },
    {
        timestamps: true,
    }
);

const QuotationLineItemModel = model<IQuotationLineItemModel>('QuotationLineItem', quotationLineItemSchema);
export default QuotationLineItemModel;
