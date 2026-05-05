import { Document, Types } from 'mongoose';

export type LeadSettingType = 'STATUS' | 'SOURCE' | 'ACTION_TYPE';

export interface ILeadSetting extends Document {
    type: LeadSettingType;
    name: string;
    color?: string;
    isDefault: boolean;
    isConvertedStatus: boolean; // only for STATUS type
    createdAt: Date;
    updatedAt: Date;
}

export interface ILead extends Document {
    name?: string;
    phone: string;
    email?: string;
    website?: string;
    source?: Types.ObjectId; // Ref to LeadSetting
    status?: Types.ObjectId; // Ref to LeadSetting
    priority?: 'High' | 'Medium' | 'Low';
    currentNotes?: string;
    nextActionType?: Types.ObjectId; // Ref to LeadSetting
    nextActionDate?: Date;
    isConverted: boolean;
    convertedClientId?: Types.ObjectId; // Ref to Client
    assignedTo?: Types.ObjectId; // Ref to User
    createdBy: Types.ObjectId; // Ref to User
    createdAt: Date;
    updatedAt: Date;
}

export type LeadActivityType = 'STATUS_CHANGE' | 'NOTE_ADDED' | 'FOLLOW_UP_SET' | 'CONVERTED' | 'CREATED';

export interface ILeadActivity extends Document {
    leadId: Types.ObjectId; // Ref to Lead
    activityType: LeadActivityType;
    previousStatus?: Types.ObjectId;
    newStatus?: Types.ObjectId;
    nextActionType?: Types.ObjectId;
    nextActionDate?: Date;
    notes?: string;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface LeadQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    priority?: string;
    source?: string;
    isConverted?: boolean;
    nextActionDateFrom?: Date | string;
    nextActionDateTo?: Date | string;
    assignedTo?: string;
}
