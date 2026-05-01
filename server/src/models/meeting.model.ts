import { model, Schema } from 'mongoose';
import type { IMeeting } from '../types/meeting.type.js';

const meetingSchema = new Schema<IMeeting>(
    {
        meetingTitle: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        scheduledAt: {
            type: Date,
            required: true,
            index: true,
        },
        durationMinutes: {
            type: Number,
            required: true,
            default: 30,
            min: 15,
            max: 480,
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        attendeeEmails: {
            type: [String],
            required: true,
            validate: {
                validator: (v: string[]) => v && v.length > 0,
                message: 'At least one attendee email is required',
            },
        },
        googleEventId: { type: String },
        googleMeetLink: { type: String },
        status: {
            type: String,
            enum: ['scheduled', 'completed', 'cancelled'],
            default: 'scheduled',
            index: true,
        },
        reminderSent: {
            type: Boolean,
            default: false,
        },
        reminder5Sent: {
            type: Boolean,
            default: false,
        },
        smsSent: {
            type: Boolean,
            default: false,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        notes: { type: String, trim: true },
    },
    {
        timestamps: true,
    },
);

// Compound index for reminder queries
meetingSchema.index({ scheduledAt: 1, reminderSent: 1, status: 1 });

const MeetingModel = model<IMeeting>('Meeting', meetingSchema);
export default MeetingModel;
