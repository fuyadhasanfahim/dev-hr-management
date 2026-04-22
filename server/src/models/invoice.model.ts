import { Schema, model, Document, Types } from 'mongoose';

export enum InvoiceStatus {
    UNPAID = 'unpaid',
    PARTIAL = 'partial',
    PAID = 'paid',
    VOID = 'void'
}

export interface IInvoiceItem {
    name: string;
    unitPrice: number;
    quantity: number;
    total: number;
    sourceType: 'order' | 'milestone';
    sourceId: Types.ObjectId;
}

export interface IInvoice extends Document {
    invoiceNumber: string;
    clientId: Types.ObjectId;
    orderId?: Types.ObjectId;
    projectId?: Types.ObjectId;
    items: IInvoiceItem[];
    currency: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paidAmount: number;
    dueAmount: number;
    paymentStatus: InvoiceStatus;
    dueDate: Date;
    notes?: string;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
    {
        name: { type: String, required: true },
        unitPrice: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
        total: { type: Number, required: true },
        sourceType: {
            type: String,
            enum: ['order', 'milestone'],
            required: true,
        },
        sourceId: { type: Schema.Types.ObjectId, required: true },
    },
    { _id: false },
);

const invoiceSchema = new Schema<IInvoice>(
    {
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
        },
        projectId: {
            type: Schema.Types.ObjectId,
            ref: 'Project',
        },
        items: [invoiceItemSchema],
        currency: {
            type: String,
            default: 'USD',
            uppercase: true,
        },
        subtotal: {
            type: Number,
            required: true,
        },
        tax: {
            type: Number,
            default: 0,
        },
        discount: {
            type: Number,
            default: 0,
        },
        total: {
            type: Number,
            required: true,
        },
        paidAmount: {
            type: Number,
            default: 0,
        },
        dueAmount: {
            type: Number,
            required: true,
        },
        paymentStatus: {
            type: String,
            enum: Object.values(InvoiceStatus),
            default: InvoiceStatus.UNPAID,
            index: true,
        },
        dueDate: {
            type: Date,
            required: true,
        },
        notes: {
            type: String,
        },
    },
    { timestamps: true },
);

// Auto-calculate total and dueAmount before saving
invoiceSchema.pre('save', function (next: any) {
    this.total = this.subtotal + this.tax - this.discount;
    this.dueAmount = Math.max(0, this.total - this.paidAmount);
    
    if (this.paidAmount <= 0) {
        this.paymentStatus = InvoiceStatus.UNPAID;
    } else if (this.paidAmount < this.total) {
        this.paymentStatus = InvoiceStatus.PARTIAL;
    } else {
        this.paymentStatus = InvoiceStatus.PAID;
    }
    
    next();
});

const InvoiceModel = model<IInvoice>('Invoice', invoiceSchema);
export default InvoiceModel;
