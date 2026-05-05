import { model, Schema } from 'mongoose';
import type { ILead } from '../types/lead.type.js';

const LeadSchema = new Schema<ILead>(
    {
        name: {
            type: String,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            index: true,
        },
        website: {
            type: String,
            trim: true,
        },
        source: {
            type: Schema.Types.ObjectId,
            ref: 'LeadSetting',
        },
        status: {
            type: Schema.Types.ObjectId,
            ref: 'LeadSetting',
        },
        priority: {
            type: String,
            enum: ['High', 'Medium', 'Low'],
            default: 'Medium',
            index: true,
        },
        currentNotes: {
            type: String,
            trim: true,
        },
        nextActionType: {
            type: Schema.Types.ObjectId,
            ref: 'LeadSetting',
        },
        nextActionDate: {
            type: Date,
        },
        isConverted: {
            type: Boolean,
            default: false,
            index: true,
        },
        convertedClientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for search
LeadSchema.index({ name: 'text', phone: 'text', email: 'text' });

const LeadModel = model<ILead>('Lead', LeadSchema);
export default LeadModel;
