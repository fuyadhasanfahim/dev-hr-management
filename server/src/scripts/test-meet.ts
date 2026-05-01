import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'fuyadhasanfahim0@gmail.com';

    console.log('--- Google Calendar Meet Creation Test via PATCH ---');
    if (!email || !privateKey) {
        console.error('Credentials missing');
        return;
    }

    const auth = new google.auth.JWT({
        email,
        key: privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    try {
        // Step 1: Create a simple event without conferencing
        const event = {
            summary: 'Test Meeting via PATCH',
            description: 'Checking Meet link generation via PATCH',
            start: { dateTime: new Date().toISOString(), timeZone: 'Asia/Dhaka' },
            end: { dateTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), timeZone: 'Asia/Dhaka' },
        };

        const res = await calendar.events.insert({
            calendarId,
            requestBody: event,
        });

        console.log('✓ Simple event created. ID:', res.data.id);

        // Step 2: Try to add conferencing via PATCH
        const patchEvent = {
            conferenceData: {
                createRequest: {
                    requestId: `meet-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            },
        };

        const resPatch = await calendar.events.patch({
            calendarId,
            eventId: res.data.id!,
            requestBody: patchEvent,
            conferenceDataVersion: 1,
        });

        console.log('✓ Meet Link from PATCH:', resPatch.data.hangoutLink);
    } catch (error: any) {
        console.error('✗ Error:', error.message);
    }
}

run();
