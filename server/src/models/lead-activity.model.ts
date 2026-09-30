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
            enum: ['STATUS_CHANGE', 'NOTE_ADDED', 'FOLLOW_UP_SET', 'CONVERTED', 'CREATED', 'UPDATED'],
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
        // The lead's note before this change, so the history shows old → new.
        previousNotes: {
            type: String,
            trim: true,
        },
        changes: {
            type: [{ field: String, from: String, to: String, _id: false }],
            default: undefined,
        },
        // null = automated (system-created leads).
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const LeadActivityModel = model<ILeadActivity>('LeadActivity', LeadActivitySchema);
export default LeadActivityModel;
