import MeetingModel from '../models/meeting.model.js';
import ClientModel from '../models/client.model.js';
import '../models/user.model.js';
import googleCalendarService from './google-calendar.service.js';
import emailService from './email.service.js';
import { sendBulkSMS } from '../utils/sms.util.js';
import type { CreateMeetingData, MeetingQueryParams, IMeeting } from '../types/meeting.type.js';
import { Types } from 'mongoose';

/**
 * Helper to fetch admin emails.
 */
async function fetchAdminEmails(): Promise<string[]> {
    try {
        const { default: UserCollection } = await import('../models/user.model.js');
        const admins = await UserCollection.find({ role: { $in: ['admin', 'super_admin'] } }).toArray();
        return admins.map((u: any) => u.email).filter(Boolean);
    } catch (err: any) {
        console.error('[Meeting] Failed to fetch admin emails:', err.message);
        return [];
    }
}

/**
 * Creates a meeting, generates a Google Meet link via Calendar API,
 * and sends confirmation email (+ SMS for everyone with a phone).
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
        console.error('[Meeting] Google Calendar integration failed:', error.message);
        throw new Error('Failed to create meeting');
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

    // Send invite email to admins as well
    const adminEmails = await fetchAdminEmails();
    for (const email of adminEmails) {
        try {
            await emailService.sendMeetingInviteEmail({
                to: email,
                clientName: 'Admin',
                meetingTitle: `${data.meetingTitle} (Client: ${client.name})`,
                scheduledAt: formattedDate,
                durationMinutes: data.durationMinutes,
                meetLink: googleMeetLink || '',
                description: data.description || '',
            });
        } catch (err: any) {
            console.error(`[Meeting] Failed to send invite email to admin ${email}:`, err.message);
        }
    }

    // SMS for client if phone exists
    if (client.phone) {
        try {
            const smsMsg = `Meeting Scheduled: "${data.meetingTitle}" on ${formattedDate} (${data.durationMinutes} mins).${googleMeetLink ? ` Join: ${googleMeetLink}` : ''} - WebBriks`;
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
                isAdmin: false,
            });
        } catch (err: any) {
            console.error(`[Meeting] Failed to send cancellation email to ${email}:`, err.message);
        }
    }

    // Notify admins by email
    const adminEmails = await fetchAdminEmails();
    for (const email of adminEmails) {
        try {
            await emailService.sendMeetingCancellationEmail({
                to: email,
                clientName: client?.name || 'Client',
                meetingTitle: meeting.meetingTitle,
                scheduledAt: formattedDate,
                isAdmin: true,
            });
        } catch (err: any) {
            console.error(`[Meeting] Failed to send cancellation email to admin ${email}:`, err.message);
        }
    }

    // SMS for client if phone exists
    if (client?.phone) {
        try {
            const smsMsg = `❌ Meeting Cancelled\n\nYour meeting "${meeting.meetingTitle}" scheduled for ${formattedDate} has been cancelled.\n\nWe apologize for the inconvenience. We’ll notify you if it is rescheduled.\n\n— Web Briks LLC`;
            await sendBulkSMS({ number: client.phone, message: smsMsg });
        } catch (err: any) {
            console.error('[Meeting] SMS cancellation failed:', err.message);
        }
    }

    return meeting;
}

async function updateMeeting(meetingId: string, data: Partial<CreateMeetingData>): Promise<IMeeting> {
    const meeting = await MeetingModel.findById(meetingId);
    if (!meeting) throw new Error('Meeting not found');

    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : meeting.scheduledAt;
    const durationMinutes = data.durationMinutes !== undefined ? data.durationMinutes : meeting.durationMinutes;

    meeting.meetingTitle = data.meetingTitle || meeting.meetingTitle;
    meeting.description = (data.description !== undefined ? data.description : meeting.description) as any;
    meeting.notes = (data.notes !== undefined ? data.notes : meeting.notes) as any;
    meeting.scheduledAt = scheduledAt;
    meeting.durationMinutes = durationMinutes;

    if (data.attendeeEmails) {
        meeting.attendeeEmails = data.attendeeEmails;
    }

    if (meeting.googleEventId) {
        try {
            const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
            await googleCalendarService.updateMeetingEvent(
                meeting.googleEventId,
                meeting.meetingTitle,
                meeting.description || '',
                scheduledAt,
                endTime,
                meeting.attendeeEmails,
            );
        } catch (err: any) {
            console.error('[Meeting] Google Calendar update failed:', err.message);
            throw new Error('Failed to update meeting');
        }
    }

    await meeting.save();

    const client = await ClientModel.findById(meeting.clientId);
    const formattedDate = scheduledAt.toLocaleString('en-US', {
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
            await emailService.sendMeetingInviteEmail({
                to: email,
                clientName: client?.name || 'Client',
                meetingTitle: meeting.meetingTitle,
                scheduledAt: formattedDate,
                durationMinutes: meeting.durationMinutes,
                meetLink: meeting.googleMeetLink || '',
                description: meeting.description || '',
            });
        } catch (err: any) {
            console.error(`[Meeting] Failed to send update email to ${email}:`, err.message);
        }
    }

    // Notify admins by email
    const adminEmails = await fetchAdminEmails();
    for (const email of adminEmails) {
        try {
            await emailService.sendMeetingInviteEmail({
                to: email,
                clientName: 'Admin',
                meetingTitle: `${meeting.meetingTitle} (Client: ${client?.name || 'Client'})`,
                scheduledAt: formattedDate,
                durationMinutes: meeting.durationMinutes,
                meetLink: meeting.googleMeetLink || '',
                description: meeting.description || '',
            });
        } catch (err: any) {
            console.error(`[Meeting] Failed to send update email to admin ${email}:`, err.message);
        }
    }

    // SMS for client if phone exists
    if (client?.phone) {
        try {
            const smsMsg = `Meeting Updated: "${meeting.meetingTitle}" has been rescheduled to ${formattedDate} (${meeting.durationMinutes} mins). Link: ${meeting.googleMeetLink || ''} - WebBriks`;
            await sendBulkSMS({ number: client.phone, message: smsMsg });
        } catch (err: any) {
            console.error('[Meeting] SMS update failed:', err.message);
        }
    }

    return meeting;
}

async function deleteMeeting(meetingId: string): Promise<IMeeting> {
    const meeting = await MeetingModel.findById(meetingId);
    if (!meeting) throw new Error('Meeting not found');

    if (meeting.googleEventId) {
        try {
            await googleCalendarService.deleteMeetingEvent(meeting.googleEventId);
        } catch (err: any) {
            console.error('[Meeting] Google Calendar deletion failed:', err.message);
        }
    }

    await MeetingModel.findByIdAndDelete(meetingId);

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
                isAdmin: false,
            });
        } catch (err: any) {
            console.error(`[Meeting] Failed to send deletion email to ${email}:`, err.message);
        }
    }

    // Notify admins by email
    const adminEmails = await fetchAdminEmails();
    for (const email of adminEmails) {
        try {
            await emailService.sendMeetingCancellationEmail({
                to: email,
                clientName: client?.name || 'Client',
                meetingTitle: meeting.meetingTitle,
                scheduledAt: formattedDate,
                isAdmin: true,
            });
        } catch (err: any) {
            console.error(`[Meeting] Failed to send deletion email to admin ${email}:`, err.message);
        }
    }

    // SMS for client if phone exists
    if (client?.phone) {
        try {
            const smsMsg = `❌ Meeting Cancelled\n\nYour meeting "${meeting.meetingTitle}" scheduled for ${formattedDate} has been cancelled.\n\nWe apologize for the inconvenience. We’ll notify you if it is rescheduled.\n\n— Web Briks LLC`;
            await sendBulkSMS({ number: client.phone, message: smsMsg });
        } catch (err: any) {
            console.error('[Meeting] SMS deletion failed:', err.message);
        }
    }

    return meeting;
}

/**
 * Process meeting reminders — called by scheduler every minute.
 * Finds meetings starting within the next 30 minutes that haven't been reminded,
 * and next 5 minutes that haven't been reminded.
 */
async function processMeetingReminders(): Promise<{ reminded: number; smsSent: number }> {
    const now = new Date();
    let reminded = 0;
    let smsSentCount = 0;

    const adminEmails = await fetchAdminEmails();

    // --- 1. Process 30-minute Reminders ---
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    const thirtyMinMeetings = await MeetingModel.find({
        status: 'scheduled',
        reminderSent: false,
        scheduledAt: { $gte: now, $lte: thirtyMinutesFromNow },
    }).populate('clientId', 'name emails phone currency');

    for (const meeting of thirtyMinMeetings) {
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

        // 1a. Send email to attendees
        for (const email of meeting.attendeeEmails) {
            try {
                await emailService.sendMeetingReminderEmail({
                    to: email,
                    clientName: client?.name || 'Client',
                    meetingTitle: meeting.meetingTitle,
                    scheduledAt: formattedDate,
                    durationMinutes: meeting.durationMinutes,
                    meetLink: meeting.googleMeetLink || '',
                });
            } catch (err: any) {
                console.error(`[Meeting] 30m Reminder email failed for attendee ${email}:`, err.message);
            }
        }

        // 1b. Send email to admins
        for (const email of adminEmails) {
            try {
                await emailService.sendMeetingReminderEmail({
                    to: email,
                    clientName: 'Admin',
                    meetingTitle: `${meeting.meetingTitle} (Client: ${client?.name || 'N/A'})`,
                    scheduledAt: formattedDate,
                    durationMinutes: meeting.durationMinutes,
                    meetLink: meeting.googleMeetLink || '',
                });
            } catch (err: any) {
                console.error(`[Meeting] 30m Reminder email failed for admin ${email}:`, err.message);
            }
        }

        meeting.reminderSent = true;

        // 1c. SMS for client if phone exists
        if (client?.phone) {
            try {
                const smsMsg = `Reminder: Your meeting "${meeting.meetingTitle}" on ${formattedDate} (${meeting.durationMinutes} mins).${meeting.googleMeetLink ? ` Join: ${meeting.googleMeetLink}` : ''} - WebBriks`;
                await sendBulkSMS({ number: client.phone, message: smsMsg });
                meeting.smsSent = true;
                smsSentCount++;
            } catch (err: any) {
                console.error('[Meeting] 30m SMS reminder failed:', err.message);
            }
        }

        await meeting.save();
        reminded++;
    }

    // --- 2. Process 5-minute Reminders ---
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    const fiveMinMeetings = await MeetingModel.find({
        status: 'scheduled',
        reminder5Sent: { $ne: true },
        scheduledAt: { $gte: now, $lte: fiveMinutesFromNow },
    }).populate('clientId', 'name emails phone currency');

    for (const meeting of fiveMinMeetings) {
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

        // 2a. Send email to attendees
        for (const email of meeting.attendeeEmails) {
            try {
                await emailService.sendMeetingReminderEmail({
                    to: email,
                    clientName: client?.name || 'Client',
                    meetingTitle: meeting.meetingTitle,
                    scheduledAt: formattedDate,
                    durationMinutes: meeting.durationMinutes,
                    meetLink: meeting.googleMeetLink || '',
                });
            } catch (err: any) {
                console.error(`[Meeting] 5m Reminder email failed for attendee ${email}:`, err.message);
            }
        }

        // 2b. Send email to admins
        for (const email of adminEmails) {
            try {
                await emailService.sendMeetingReminderEmail({
                    to: email,
                    clientName: 'Admin',
                    meetingTitle: `${meeting.meetingTitle} (Client: ${client?.name || 'N/A'})`,
                    scheduledAt: formattedDate,
                    durationMinutes: meeting.durationMinutes,
                    meetLink: meeting.googleMeetLink || '',
                });
            } catch (err: any) {
                console.error(`[Meeting] 5m Reminder email failed for admin ${email}:`, err.message);
            }
        }

        meeting.reminder5Sent = true;

        // 2c. SMS for client if phone exists
        if (client?.phone) {
            try {
                const smsMsg = `Reminder: Your meeting "${meeting.meetingTitle}" on ${formattedDate} (${meeting.durationMinutes} mins).${meeting.googleMeetLink ? ` Join: ${meeting.googleMeetLink}` : ''} - WebBriks`;
                await sendBulkSMS({ number: client.phone, message: smsMsg });
                meeting.smsSent = true;
                smsSentCount++;
            } catch (err: any) {
                console.error('[Meeting] 5m SMS reminder failed:', err.message);
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
    updateMeeting,
    deleteMeeting,
    processMeetingReminders,
};
