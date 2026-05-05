import { model, Schema } from 'mongoose';
import type { ILeadActivity } from '../types/lead.type.js';

const LeadActivitySchema = new Schema<ILeadActivity>(
    {
        leadId: {
            type: Schema.Types.ObjectId,
            ref: 'Lead',
            required: true,
            index: true,
        },
        activityType: {
            type: String,
            enum: ['STATUS_CHANGE', 'NOTE_ADDED', 'FOLLOW_UP_SET', 'CONVERTED', 'CREATED'],
            required: true,
        },
        previousStatus: {
            type: Schema.Types.ObjectId,
            ref: 'LeadSetting',
        },
        newStatus: {
            type: Schema.Types.ObjectId,
            ref: 'LeadSetting',
        },
        nextActionType: {
            type: Schema.Types.ObjectId,
            ref: 'LeadSetting',
        },
        nextActionDate: {
            type: Date,
        },
        notes: {
            type: String,
            trim: true,
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

const LeadActivityModel = model<ILeadActivity>('LeadActivity', LeadActivitySchema);
export default LeadActivityModel;
