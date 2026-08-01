import { Schema, model, Document, Types } from 'mongoose';

export interface IOrderMilestoneModel extends Document {
    orderId: Types.ObjectId;
    milestone: string;
    completedAt: Date;
    completedBy: Types.ObjectId;
    notes?: string;
}

const orderMilestoneSchema = new Schema<IOrderMilestoneModel>(
    {
        orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
        milestone: { type: String, required: true },
        completedAt: { type: Date, required: true },
        completedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        notes: { type: String },
    },
    { timestamps: true }
);

const OrderMilestoneModel = model<IOrderMilestoneModel>('OrderMilestone', orderMilestoneSchema);
export default OrderMilestoneModel;
