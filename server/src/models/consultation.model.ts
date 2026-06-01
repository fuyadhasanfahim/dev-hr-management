import { model, Schema } from 'mongoose';
import type { IConsultation } from '../types/consultation.type.js';

const ConsultationSchema = new Schema<IConsultation>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        projectDescription: {
            type: String,
            required: true,
            trim: true,
        },
        projectType: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ['pending', 'scheduled', 'completed', 'cancelled'],
            default: 'pending',
        },
        scheduledAt: {
            type: Date,
        },
        meetingLink: {
            type: String,
            trim: true,
        },
        adminNotes: {
            type: String,
            trim: true,
        },
        source: {
            type: String,
            enum: ['ai_chat', 'manual'],
            default: 'ai_chat',
        },
        chatTranscript: {
            type: String,
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        meetingId: {
            type: Schema.Types.ObjectId,
            ref: 'Meeting',
        },
    },
    {
        timestamps: true,
    },
);

ConsultationSchema.index({ status: 1, createdAt: -1 });
ConsultationSchema.index({ email: 1 });

const ConsultationModel = model<IConsultation>('Consultation', ConsultationSchema);
export default ConsultationModel;
