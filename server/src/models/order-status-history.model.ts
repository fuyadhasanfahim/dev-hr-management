import { Schema, model, Document, Types } from 'mongoose';

// Ensure this matches the OrderStatus from order.model.ts or extract to a shared types file
export enum OrderStatus {
    PENDING            = 'pending',
    IN_PROGRESS        = 'in_progress',
    REVISION           = 'revision',
    COMPLETED          = 'completed',
    DELIVERED          = 'delivered',
    CANCELLED          = 'cancelled',
}

export interface IOrderStatusHistoryModel extends Document {
    orderId: Types.ObjectId;
    status: OrderStatus;
    changedBy: Types.ObjectId;
    updatedAt: Date;
    note?: string;
}

const orderStatusHistorySchema = new Schema<IOrderStatusHistoryModel>(
    {
        orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
        status: { type: String, enum: Object.values(OrderStatus), required: true },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        updatedAt: { type: Date, default: Date.now },
        note: { type: String },
    }
    // No timestamps needed since updatedAt is handled manually/specifically
);

const OrderStatusHistoryModel = model<IOrderStatusHistoryModel>('OrderStatusHistory', orderStatusHistorySchema);
export default OrderStatusHistoryModel;
