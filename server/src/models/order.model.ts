import { Schema, model, Document, Types } from 'mongoose';
import { PricingModel } from './service.model.js';

export enum OrderStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export enum OrderType {
    PROJECT = 'project',
    SERVICE = 'service',
    SUBSCRIPTION = 'subscription'
}

export interface IOrderItem {
    serviceId?: Types.ObjectId;
    name: string;
    pricingModel: PricingModel;
    quantity?: number;
    hours?: number;
    unitPrice: number;
    totalPrice: number;
}

export interface IStatusHistory {
    status: OrderStatus;
    changedBy: Types.ObjectId;
    updatedAt: Date;
    note?: string;
}

export interface IOrder extends Document {
    clientId: Types.ObjectId;
    title: string;
    description?: string;
    orderType: OrderType;
    status: OrderStatus;
    currency: string;
    totalAmount: number;
    items: IOrderItem[];
    statusHistory: IStatusHistory[];
    createdBy: Types.ObjectId;
}

const orderItemSchema = new Schema<IOrderItem>(
    {
        serviceId: {
            type: Schema.Types.ObjectId,
            ref: 'Service',
        },
        name: {
            type: String,
            required: true,
        },
        pricingModel: {
            type: String,
            enum: Object.values(PricingModel),
            required: true,
        },
        quantity: {
            type: Number,
            min: 1,
        },
        hours: {
            type: Number,
            min: 0.1,
        },
        unitPrice: {
            type: Number,
            required: true,
        },
        totalPrice: {
            type: Number,
            required: true,
        },
    },
    { _id: false },
);

const orderSchema = new Schema<IOrder>(
    {
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
        },
        orderType: {
            type: String,
            enum: Object.values(OrderType),
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: Object.values(OrderStatus),
            default: OrderStatus.PENDING,
            index: true,
        },
        currency: {
            type: String,
            default: 'USD',
            required: true,
            uppercase: true,
        },
        totalAmount: {
            type: Number,
            default: 0,
        },
        items: [orderItemSchema],
        statusHistory: [
            {
                status: { type: String, enum: Object.values(OrderStatus) },
                changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
                updatedAt: { type: Date, default: Date.now },
                note: String,
            },
        ],
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true },
);

// Auto-calculate totalAmount before saving
orderSchema.pre('save', function () {
    if (this.items && this.items.length > 0) {
        this.totalAmount = this.items.reduce((sum, item) => {
            // Re-calculate totalPrice to ensure integrity
            const qty = item.quantity || 1;
            const hours = item.hours || 1;
            
            // If it's hourly, use hours, otherwise use quantity
            const multiplier = item.pricingModel === PricingModel.HOURLY ? hours : qty;
            item.totalPrice = item.unitPrice * multiplier;
            
            return sum + item.totalPrice;
        }, 0);
    } else {
        this.totalAmount = 0;
    }
});

const OrderModel = model<IOrder>('Order', orderSchema);
export default OrderModel;
