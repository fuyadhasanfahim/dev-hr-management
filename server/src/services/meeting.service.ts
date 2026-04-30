import MeetingModel from '../models/meeting.model.js';
import ClientModel from '../models/client.model.js';
import googleCalendarService from './google-calendar.service.js';
import emailService from './email.service.js';
import { sendBulkSMS } from '../utils/sms.util.js';
import type { CreateMeetingData, MeetingQueryParams, IMeeting } from '../types/meeting.type.js';
import { Types } from 'mongoose';

/**
 * Creates a meeting, generates a Google Meet link via Calendar API,
 * and sends confirmation email (+ SMS for BDT clients).
 */
async function createMeeting(data: CreateMeetingData): Promise<IMeeting> {
    const client = await ClientModel.findById(data.clientId);
    if (!client) throw new Error('Client not found');

    // Merge client emails with any additional attendee emails
    const attendeeEmails = Array.from(
        new Set([
            ...client.emails,
            ...(data.attendeeEmails || []),
        ]),
    );

    const scheduledAt = new Date(data.scheduledAt);
    const endTime = new Date(scheduledAt.getTime() + data.durationMinutes * 60 * 1000);

    // Create Google Calendar event with Meet link
    let googleEventId: string | undefined;
    let googleMeetLink: string | undefined;

    try {
        const calendarResult = await googleCalendarService.createMeetingEvent(
            data.meetingTitle,
            data.description || '',
            scheduledAt,
            endTime,
            attendeeEmails,
        );
        googleEventId = calendarResult.eventId;
        googleMeetLink = calendarResult.meetLink;
        console.log('[Meeting] Google Calendar event created:', {
            eventId: googleEventId,
            meetLink: googleMeetLink,
        });
    } catch (error: any) {
        console.error('[Meeting] Google Calendar integration failed, creating meeting without Meet link:', error.message);
        // Continue without Google Meet — meeting is still valid
    }

    const meetingPayload: Record<string, any> = {
        meetingTitle: data.meetingTitle,
        scheduledAt,
        durationMinutes: data.durationMinutes,
        clientId: new Types.ObjectId(data.clientId),
        attendeeEmails,
        status: 'scheduled',
        reminderSent: false,
        smsSent: false,
        createdBy: new Types.ObjectId(data.createdBy),
    };

    if (data.description) meetingPayload.description = data.description;
    if (googleEventId) meetingPayload.googleEventId = googleEventId;
    if (googleMeetLink) meetingPayload.googleMeetLink = googleMeetLink;
    if (data.notes) meetingPayload.notes = data.notes;

    const meeting = await MeetingModel.create(meetingPayload);

    // Send confirmation email to all attendees
    const formattedDate = scheduledAt.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dhaka',
    });

    for (const email of attendeeEmails) {
        try {
            await emailService.sendMeetingInviteEmail({
                to: email,
                clientName: client.name,
                meetingTitle: data.meetingTitle,
                scheduledAt: formattedDate,
                durationMinutes: data.durationMinutes,
                meetLink: googleMeetLink || '',
                description: data.description || '',
            });
        } catch (err: any) {
            console.error(`[Meeting] Failed to send invite email to ${email}:`, err.message);
        }
    }

    // SMS for BDT-currency clients
    if (client.currency?.toUpperCase() === 'BDT' && client.phone) {
        try {
            const smsMsg = `Meeting Scheduled: "${data.meetingTitle}" on ${formattedDate}.${googleMeetLink ? ` Join: ${googleMeetLink}` : ''} - WebBriks`;
            await sendBulkSMS({ number: client.phone, message: smsMsg });
            console.log('[Meeting] SMS confirmation sent to', client.phone);
        } catch (err: any) {
            console.error('[Meeting] SMS confirmation failed:', err.message);
        }
    }

    return meeting;
}

/**
 * List meetings with pagination and filters.
 */
async function getMeetings(params: MeetingQueryParams) {
    const { page = 1, limit = 20, clientId, status, startDate, endDate } = params;
    const filter: Record<string, any> = {};

    if (clientId) filter.clientId = new Types.ObjectId(clientId);
    if (status) filter.status = status;

    if (startDate || endDate) {
        filter.scheduledAt = {};
        if (startDate) filter.scheduledAt.$gte = new Date(startDate);
        if (endDate) filter.scheduledAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [meetings, total] = await Promise.all([
        MeetingModel.find(filter)
            .populate('clientId', 'clientId name emails phone currency')
            .populate('createdBy', 'name email')
            .sort({ scheduledAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        MeetingModel.countDocuments(filter),
    ]);

    return {
        data: meetings,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/**
 * Get a single meeting by ID.
 */
async function getMeetingById(id: string) {
    return MeetingModel.findById(id)
        .populate('clientId', 'clientId name emails phone currency')
        .populate('createdBy', 'name email')
        .lean();
}

/**
 * Cancel a meeting — updates status and removes Google Calendar event.
 */
async function cancelMeeting(id: string): Promise<IMeeting | null> {
    const meeting = await MeetingModel.findById(id);
    if (!meeting) throw new Error('Meeting not found');
    if (meeting.status === 'cancelled') throw new Error('Meeting is already cancelled');

    // Cancel Google Calendar event
    if (meeting.googleEventId) {
        try {
            await googleCalendarService.cancelMeetingEvent(meeting.googleEventId);
            console.log('[Meeting] Google Calendar event cancelled:', meeting.googleEventId);
        } catch (err: any) {
            console.error('[Meeting] Failed to cancel Google event:', err.message);
        }
    }

    meeting.status = 'cancelled';
    await meeting.save();

    // Notify attendees by email
    const client = await ClientModel.findById(meeting.clientId);
    const formattedDate = meeting.scheduledAt.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dhaka',
    });

    for (const email of meeting.attendeeEmails) {
        try {
            await emailService.sendMeetingCancellationEmail({
                to: email,
                clientName: client?.name || 'Client',
                meetingTitle: meeting.meetingTitle,
                scheduledAt: formattedDate,
            });
        } catch (err: any) {
            console.error(`[Meeting] Failed to send cancellation email to ${email}:`, err.message);
        }
    }

    // SMS for BDT client
    if (client?.currency?.toUpperCase() === 'BDT' && client.phone) {
        try {
            const smsMsg = `Meeting Cancelled: "${meeting.meetingTitle}" scheduled for ${formattedDate} has been cancelled. - WebBriks`;
            await sendBulkSMS({ number: client.phone, message: smsMsg });
        } catch (err: any) {
            console.error('[Meeting] SMS cancellation failed:', err.message);
        }
    }

    return meeting;
}

/**
 * Process meeting reminders — called by scheduler every minute.
 * Finds meetings starting within the next 30 minutes that haven't been reminded.
 */
async function processMeetingReminders(): Promise<{ reminded: number; smsSent: number }> {
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    const meetings = await MeetingModel.find({
        status: 'scheduled',
        reminderSent: false,
        scheduledAt: { $gte: now, $lte: thirtyMinutesFromNow },
    }).populate('clientId', 'name emails phone currency');

    let reminded = 0;
    let smsSentCount = 0;

    for (const meeting of meetings) {
        const client = meeting.clientId as any;
        const formattedDate = meeting.scheduledAt.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Dhaka',
        });

        // Send reminder emails to all attendees
        for (const email of meeting.attendeeEmails) {
            try {
                await emailService.sendMeetingReminderEmail({
                    to: email,
                    clientName: client?.name || 'Client',
                    meetingTitle: meeting.meetingTitle,
                    scheduledAt: formattedDate,
                    meetLink: meeting.googleMeetLink || '',
                });
            } catch (err: any) {
                console.error(`[Meeting] Reminder email failed for ${email}:`, err.message);
            }
        }

        meeting.reminderSent = true;

        // SMS for BDT-currency clients
        if (client?.currency?.toUpperCase() === 'BDT' && client.phone) {
            try {
                const smsMsg = `Reminder: Your meeting "${meeting.meetingTitle}" starts in 30 minutes.${meeting.googleMeetLink ? ` Join: ${meeting.googleMeetLink}` : ''} - WebBriks`;
                await sendBulkSMS({ number: client.phone, message: smsMsg });
                meeting.smsSent = true;
                smsSentCount++;
            } catch (err: any) {
                console.error('[Meeting] SMS reminder failed:', err.message);
            }
        }

        await meeting.save();
        reminded++;
    }

    if (reminded > 0) {
        console.log(`[Meeting] Sent ${reminded} reminders, ${smsSentCount} SMS`);
    }

    return { reminded, smsSent: smsSentCount };
}

export default {
    createMeeting,
    getMeetings,
    getMeetingById,
    cancelMeeting,
    processMeetingReminders,
};
