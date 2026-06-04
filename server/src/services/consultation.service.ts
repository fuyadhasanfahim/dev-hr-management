import ConsultationModel from '../models/consultation.model.js';
import type { ConsultationQueryParams, ConsultationStatus } from '../types/consultation.type.js';
import { logger } from '../lib/logger.js';
import meetingService from './meeting.service.js';

async function createConsultation(data: {
    name: string;
    email: string;
    phone?: string;
    projectDescription: string;
    projectType?: string;
    source?: 'ai_chat' | 'manual';
    chatTranscript?: string;
}) {
    const consultation = await ConsultationModel.create({
        ...data,
        status: 'pending',
        source: data.source || 'ai_chat',
    });

    logger.info(`New consultation request from ${data.name} (${data.email})`);

    return consultation;
}

async function getConsultations(params: ConsultationQueryParams) {
    const { page = 1, limit = 20, search, status } = params;
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (status) {
        filter.status = status;
    }

    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { projectDescription: { $regex: search, $options: 'i' } },
        ];
    }

    const [consultations, total] = await Promise.all([
        ConsultationModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('assignedTo', 'name email')
            .populate('meetingId', 'meetingTitle scheduledAt durationMinutes googleMeetLink status')
            .lean(),
        ConsultationModel.countDocuments(filter),
    ]);

    return {
        consultations,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}

async function getConsultationById(id: string) {
    const consultation = await ConsultationModel.findById(id)
        .populate('assignedTo', 'name email')
        .populate('meetingId', 'meetingTitle scheduledAt durationMinutes googleMeetLink status attendeeEmails attendeePhones')
        .lean();

    if (!consultation) {
        const err: any = new Error('Consultation not found');
        err.statusCode = 404;
        throw err;
    }

    return consultation;
}

/**
 * Update consultation. When status is set to 'scheduled' with a scheduledAt date,
 * auto-creates a meeting with Google Meet link via the existing meeting system.
 */
async function updateConsultation(
    id: string,
    data: {
        status?: ConsultationStatus;
        scheduledAt?: Date;
        durationMinutes?: number;
        adminNotes?: string;
        assignedTo?: string;
    },
) {
    const consultation = await ConsultationModel.findById(id);

    if (!consultation) {
        const err: any = new Error('Consultation not found');
        err.statusCode = 404;
        throw err;
    }

    const wasNotScheduled = consultation.status !== 'scheduled';

    if (data.adminNotes !== undefined) consultation.adminNotes = data.adminNotes;
    if (data.assignedTo) consultation.assignedTo = data.assignedTo as any;

    // Schedule consultation → create a meeting with Google Meet
    if (data.status === 'scheduled' && wasNotScheduled && data.scheduledAt) {
        try {
            const duration = data.durationMinutes || 30;
            const attendeeEmails = [consultation.email];
            const attendeePhones = consultation.phone ? [consultation.phone] : [];

            const meeting = await meetingService.createMeeting({
                meetingTitle: `Consultation: ${consultation.name} — ${consultation.projectType || 'Project Discussion'}`,
                description: `Consultation for: ${consultation.projectDescription}\n\nClient: ${consultation.name}\nEmail: ${consultation.email}${consultation.phone ? `\nPhone: ${consultation.phone}` : ''}`,
                scheduledAt: data.scheduledAt.toISOString(),
                durationMinutes: duration,
                attendeeEmails,
                attendeePhones,
                createdBy: data.assignedTo || consultation.assignedTo?.toString() || '',
                notes: consultation.adminNotes || '',
            });

            consultation.meetingId = meeting._id as any;
            consultation.meetingLink = meeting.googleMeetLink || '';
            consultation.scheduledAt = data.scheduledAt;
            consultation.status = 'scheduled';

            logger.info(`Meeting created for consultation ${id}: ${meeting.googleMeetLink}`);
        } catch (err: any) {
            logger.error(`Failed to create meeting for consultation ${id}: ${err.message}`);
            throw new Error(`Failed to schedule consultation: ${err.message}`);
        }
    } else {
        if (data.status) consultation.status = data.status;
        if (data.scheduledAt) consultation.scheduledAt = data.scheduledAt;
    }

    await consultation.save();

    return consultation;
}

async function deleteConsultation(id: string) {
    const result = await ConsultationModel.findByIdAndDelete(id);
    if (!result) {
        const err: any = new Error('Consultation not found');
        err.statusCode = 404;
        throw err;
    }
    return result;
}

async function getStats() {
    const [pending, scheduled, completed, cancelled] = await Promise.all([
        ConsultationModel.countDocuments({ status: 'pending' }),
        ConsultationModel.countDocuments({ status: 'scheduled' }),
        ConsultationModel.countDocuments({ status: 'completed' }),
        ConsultationModel.countDocuments({ status: 'cancelled' }),
    ]);

    return { pending, scheduled, completed, cancelled, total: pending + scheduled + completed + cancelled };
}

export default {
    createConsultation,
    getConsultations,
    getConsultationById,
    updateConsultation,
    deleteConsultation,
    getStats,
};
