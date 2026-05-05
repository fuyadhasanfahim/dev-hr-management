export type LeadSettingType = 'STATUS' | 'SOURCE' | 'ACTION_TYPE';

export interface LeadSetting {
    _id: string;
    type: LeadSettingType;
    name: string;
    color?: string;
    isDefault: boolean;
    isConvertedStatus: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Lead {
    _id: string;
    name?: string;
    phone: string;
    email?: string;
    website?: string;
    source?: LeadSetting;
    status?: LeadSetting;
    priority?: 'High' | 'Medium' | 'Low';
    currentNotes?: string;
    nextActionType?: LeadSetting;
    nextActionDate?: string;
    isConverted: boolean;
    convertedClientId?: string; // ID of the client
    assignedTo?: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export type LeadActivityType = 'STATUS_CHANGE' | 'NOTE_ADDED' | 'FOLLOW_UP_SET' | 'CONVERTED' | 'CREATED';

export interface LeadActivity {
    _id: string;
    leadId: string;
    activityType: LeadActivityType;
    previousStatus?: LeadSetting;
    newStatus?: LeadSetting;
    nextActionType?: LeadSetting;
    nextActionDate?: string;
    notes?: string;
    createdBy: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface LeadPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
