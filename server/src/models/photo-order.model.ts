import { model, Schema, type Document, type Types } from 'mongoose';

export const PHOTO_ORDER_STATUSES = [
    'pending',
    'in_progress',
    'quality_check',
    'revision',
    'ready_to_deliver',
    'completed',
    'delivered',
    'cancelled',
] as const;
export type PhotoOrderStatus = (typeof PHOTO_ORDER_STATUSES)[number];

export const PHOTO_ORDER_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type PhotoOrderPriority = (typeof PHOTO_ORDER_PRIORITIES)[number];

export interface IPhotoOrder extends Document {
    orderName: string;
    clientId: Types.ObjectId;
    contactPersonId?: Types.ObjectId;
    orderDate: Date;
    deadline: Date;
    originalDeadline?: Date;
    imageQuantity: number;
    perImagePrice: number;
    totalPrice: number;
    services: Types.ObjectId[];
    returnFileFormat: Types.ObjectId;
    instruction?: string;
    notes?: string;
    status: PhotoOrderStatus;
    priority: PhotoOrderPriority;
    revisionCount: number;
    revisionInstructions: { instruction: string; createdAt: Date; createdBy: Types.ObjectId }[];
    timeline: { status: PhotoOrderStatus; timestamp: Date; changedBy: Types.ObjectId; note?: string }[];
    completedAt?: Date;
    deliveredAt?: Date;
    invoiceId?: Types.ObjectId;
    invoiceNumber?: string;
    isPaid: boolean;
    createdBy: Types.ObjectId;
}

const photoOrderSchema = new Schema<IPhotoOrder>(
    {
        orderName: { type: String, required: true, trim: true, index: true },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
        contactPersonId: { type: Schema.Types.ObjectId },
        orderDate: { type: Date, required: true, index: true },
        deadline: { type: Date, required: true },
        originalDeadline: { type: Date },
        imageQuantity: { type: Number, required: true, min: 1 },
        perImagePrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        services: [{ type: Schema.Types.ObjectId, ref: 'PhotoService' }],
        returnFileFormat: { type: Schema.Types.ObjectId, ref: 'PhotoReturnFormat', required: true },
        instruction: { type: String, trim: true },
        notes: { type: String, trim: true },
        status: { type: String, enum: PHOTO_ORDER_STATUSES, default: 'pending', index: true },
        priority: { type: String, enum: PHOTO_ORDER_PRIORITIES, default: 'normal' },
        revisionCount: { type: Number, default: 0 },
        revisionInstructions: [
            new Schema(
                {
                    instruction: { type: String, required: true },
                    createdAt: { type: Date, default: Date.now },
                    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
                },
                { _id: false },
            ),
        ],
        timeline: [
            new Schema(
                {
                    status: { type: String, enum: PHOTO_ORDER_STATUSES, required: true },
                    timestamp: { type: Date, default: Date.now },
                    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
                    note: { type: String },
                },
                { _id: false },
            ),
        ],
        completedAt: { type: Date },
        deliveredAt: { type: Date },
        invoiceId: { type: Schema.Types.ObjectId, ref: 'PhotoInvoice', index: true },
        invoiceNumber: { type: String },
        isPaid: { type: Boolean, default: false },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);

photoOrderSchema.index({ clientId: 1, orderDate: -1 });

export default model<IPhotoOrder>('PhotoOrder', photoOrderSchema);
