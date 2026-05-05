import { model, Schema } from 'mongoose';
import type { ILeadSetting } from '../types/lead.type.js';

const LeadSettingSchema = new Schema<ILeadSetting>(
    {
        type: {
            type: String,
            enum: ['STATUS', 'SOURCE', 'ACTION_TYPE'],
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        color: {
            type: String,
            trim: true,
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
        isConvertedStatus: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

const LeadSettingModel = model<ILeadSetting>('LeadSetting', LeadSettingSchema);
export default LeadSettingModel;
