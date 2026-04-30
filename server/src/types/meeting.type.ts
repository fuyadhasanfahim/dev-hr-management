import { Document, Types } from 'mongoose';

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled';

export interface IMeeting extends Document {
    meetingTitle: string;
    description?: string;
    scheduledAt: Date;
    durationMinutes: number;
    clientId: Types.ObjectId;
    attendeeEmails: string[];
    googleEventId?: string;
    googleMeetLink?: string;
    status: MeetingStatus;
    reminderSent: boolean;
    smsSent: boolean;
    createdBy: Types.ObjectId;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateMeetingData {
    meetingTitle: string;
    description?: string;
    scheduledAt: string; // ISO date string from client
    durationMinutes: number;
    clientId: string;
    attendeeEmails?: string[];
    notes?: string;
    createdBy: string;
}

export interface MeetingQueryParams {
    page?: number;
    limit?: number;
    clientId?: string;
    status?: MeetingStatus;
    startDate?: string;
    endDate?: string;
}
