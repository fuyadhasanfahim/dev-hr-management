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
    createdBy?: Types.ObjectId | null; // Ref to User — null when the system created it (e.g. from WhatsApp)
    updatedBy?: Types.ObjectId | null; // Ref to User — last person to change it
    origin?: 'manual' | 'whatsapp';
    createdAt: Date;
    updatedAt: Date;
}

export type LeadActivityType = 'STATUS_CHANGE' | 'NOTE_ADDED' | 'FOLLOW_UP_SET' | 'CONVERTED' | 'CREATED' | 'UPDATED';

/** One field edit recorded on an UPDATED activity (values as display strings). */
export interface LeadFieldChange {
    field: string;
    from?: string | null;
    to?: string | null;
}

export interface ILeadActivity extends Document {
    leadId: Types.ObjectId; // Ref to Lead
    activityType: LeadActivityType;
    previousStatus?: Types.ObjectId;
    newStatus?: Types.ObjectId;
    nextActionType?: Types.ObjectId;
    nextActionDate?: Date;
    notes?: string;
    previousNotes?: string; // What the lead's note said before this change
    changes?: LeadFieldChange[];
    createdBy?: Types.ObjectId | null; // null = automated
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
    nextActionType?: string;
    nextActionDateFrom?: Date | string;
    nextActionDateTo?: Date | string;
    assignedTo?: string;
    createdBy?: string; // user id, or 'automated' for system-created leads
    updatedBy?: string; // user id, or 'automated' (never touched by a person)
}
