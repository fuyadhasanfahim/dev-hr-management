import { model, Schema, type Document, type Types } from 'mongoose';

export interface IPhotoInvoiceItem {
    orderId: Types.ObjectId;
    orderName: string;
    date: Date;
    images: number;
    unitPrice: number;
    amount: number;
}

export interface IPhotoInvoice extends Document {
    invoiceNumber: string;
    clientId: Types.ObjectId;
    month: number;
    year: number;
    currency: string;
    items: IPhotoInvoiceItem[];
    totalImages: number;
    totalAmount: number;
    issueDate: Date;
    dueDate: Date;
    paymentStatus: 'pending' | 'paid';
    paidAt?: Date;
    paidAmount?: number;
    paidVia?: 'stripe' | 'paypal';
    gatewayRef?: string;
    emailedTo: string[];
    createdBy: Types.ObjectId;
}

const photoInvoiceSchema = new Schema<IPhotoInvoice>(
    {
        invoiceNumber: { type: String, required: true, unique: true },
        clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
        month: { type: Number, required: true, min: 1, max: 12 },
        year: { type: Number, required: true },
        currency: { type: String, required: true, default: 'USD', uppercase: true },
        items: [
            new Schema(
                {
                    orderId: { type: Schema.Types.ObjectId, ref: 'PhotoOrder', required: true },
                    orderName: { type: String, required: true },
                    date: { type: Date, required: true },
                    images: { type: Number, required: true },
                    unitPrice: { type: Number, required: true },
                    amount: { type: Number, required: true },
                },
                { _id: false },
            ),
        ],
        totalImages: { type: Number, required: true },
        totalAmount: { type: Number, required: true },
        issueDate: { type: Date, required: true },
        dueDate: { type: Date, required: true },
        paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending', index: true },
        paidAt: { type: Date },
        paidAmount: { type: Number },
        paidVia: { type: String, enum: ['stripe', 'paypal'] },
        gatewayRef: { type: String },
        emailedTo: [{ type: String }],
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);

photoInvoiceSchema.index({ year: 1, month: 1, clientId: 1 });

export default model<IPhotoInvoice>('PhotoInvoice', photoInvoiceSchema);
