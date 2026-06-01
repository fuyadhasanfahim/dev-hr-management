import { Document, Types } from 'mongoose';

export type ConsultationStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled';

export interface IConsultation extends Document {
    name: string;
    email: string;
    phone?: string;
    projectDescription: string;
    projectType?: string;
    status: ConsultationStatus;
    scheduledAt?: Date;
    meetingLink?: string;
    adminNotes?: string;
    source: 'ai_chat' | 'manual';
    chatTranscript?: string;
    assignedTo?: Types.ObjectId;
    meetingId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface ConsultationQueryParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: ConsultationStatus;
}
