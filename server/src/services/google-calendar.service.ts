import { google, calendar_v3 } from 'googleapis';
import envConfig from '../config/env.config.js';

/**
 * Google Calendar service for creating/cancelling events with Google Meet links.
 * Uses a Service Account with Domain-Wide Delegation or direct calendar access.
 */

let calendarClient: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar {
    if (calendarClient) return calendarClient;

    const email = envConfig.google_service_account_email;
    const privateKey = envConfig.google_service_account_private_key;

    if (!email || !privateKey) {
        throw new Error(
            'Google Calendar credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env',
        );
    }

    const auth = new google.auth.JWT({
        email,
        key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines from .env
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    calendarClient = google.calendar({ version: 'v3', auth });
    return calendarClient;
}

export interface GoogleMeetEventResult {
    eventId: string;
    meetLink: string;
    htmlLink: string;
}

/**
 * Creates a Google Calendar event with an auto-generated Google Meet link.
 */
async function createMeetingEvent(
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendeeEmails: string[],
): Promise<GoogleMeetEventResult> {
    const calendar = getCalendarClient();
    const calendarId = envConfig.google_calendar_id || 'primary';

    const requestId = `meeting-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const event: calendar_v3.Schema$Event = {
        summary: title,
        description: description || '',
        start: {
            dateTime: startTime.toISOString(),
            timeZone: 'Asia/Dhaka',
        },
        end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Dhaka',
        },
        attendees: attendeeEmails.map((email) => ({ email })),
        conferenceData: {
            createRequest: {
                requestId,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 30 },
                { method: 'popup', minutes: 10 },
            ],
        },
    };

    const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
        conferenceDataVersion: 1,
        sendUpdates: 'all', // Send invites to attendees
    });

    const data = response.data;
    if (!data.id) {
        throw new Error('Google Calendar event creation failed: no event ID returned');
    }

    return {
        eventId: data.id,
        meetLink: data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri || '',
        htmlLink: data.htmlLink || '',
    };
}

/**
 * Cancels (deletes) a Google Calendar event.
 */
async function cancelMeetingEvent(eventId: string): Promise<void> {
    const calendar = getCalendarClient();
    const calendarId = envConfig.google_calendar_id || 'primary';

    await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'all', // Notify attendees of cancellation
    });
}

/**
 * Updates a Google Calendar event.
 */
async function updateMeetingEvent(
    eventId: string,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    attendeeEmails: string[],
): Promise<void> {
    const calendar = getCalendarClient();
    const calendarId = envConfig.google_calendar_id || 'primary';

    const event: calendar_v3.Schema$Event = {
        summary: title,
        description: description || '',
        start: {
            dateTime: startTime.toISOString(),
            timeZone: 'Asia/Dhaka',
        },
        end: {
            dateTime: endTime.toISOString(),
            timeZone: 'Asia/Dhaka',
        },
        attendees: attendeeEmails.map((email) => ({ email })),
    };

    await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: event,
        sendUpdates: 'all',
    });
}

/**
 * Deletes a Google Calendar event.
 */
async function deleteMeetingEvent(eventId: string): Promise<void> {
    const calendar = getCalendarClient();
    const calendarId = envConfig.google_calendar_id || 'primary';

    await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'all',
    });
}

export default {
    createMeetingEvent,
    cancelMeetingEvent,
    updateMeetingEvent,
    deleteMeetingEvent,
};
