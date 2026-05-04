import { model, Schema } from 'mongoose';

const phaseSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    items: [{ type: String }],
}, { _id: false });

const serviceSchema = new Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    billingCycle: { type: String, enum: ['one-time', 'monthly', 'yearly'], default: 'one-time' },
    description: { type: String },
}, { _id: false });

const paymentMilestoneSchema = new Schema({
    label: { type: String, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    note: { type: String },
}, { _id: false });

const quotationTemplateSchema = new Schema(
    {
        name: { type: String, required: true },
        serviceType: { type: String, enum: ['web-development'], default: 'web-development' },
        details: {
            title: { type: String, required: true },
        },
        overview: String,
        phases: [phaseSchema],
        techStack: {
            frontend: { type: String, default: '' },
            backend: { type: String, default: '' },
            database: { type: String, default: '' },
            tools: [{ type: String }],
        },
        pricing: {
            basePrice: { type: Number, default: 0 },
            taxRate: { type: Number, default: 0 },
            discount: { type: Number, default: 0 },
        },
        additionalServices: [serviceSchema],
        workflow: [{ type: String }],
        paymentMilestones: { type: [paymentMilestoneSchema], default: undefined },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    {
        timestamps: true,
    }
);

const QuotationTemplateModel = model('QuotationTemplate', quotationTemplateSchema);
export default QuotationTemplateModel;
