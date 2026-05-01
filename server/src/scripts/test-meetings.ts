import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import envConfig from '../config/env.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || envConfig.google_service_account_email;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || envConfig.google_service_account_private_key;
    const customCalendarId = process.env.GOOGLE_CALENDAR_ID || envConfig.google_calendar_id;

    console.log('--- Google Calendar Advanced Auth & API Test ---');
    console.log('Service Account Email:', email);
    console.log('Calendar ID from .env:', customCalendarId);

    if (!email || !privateKey) {
        console.error('Error: Google Service Account Email or Private Key not configured.');
        return;
    }

    const auth = new google.auth.JWT({
        email,
        key: privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Test: Create a basic event WITHOUT conferencing
    console.log(`\n--- Test: Creating simple event without conferencing to check sharing ---`);
    try {
        const event = {
            summary: 'Basic Event without Meet link',
            description: 'This is just a basic event insertion to check sharing permissions',
            start: { dateTime: new Date().toISOString(), timeZone: 'Asia/Dhaka' },
            end: { dateTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), timeZone: 'Asia/Dhaka' },
        };

        const res = await calendar.events.insert({
            calendarId: customCalendarId || 'primary',
            requestBody: event,
        });

        console.log('✓ Success! Simple event inserted without any issues.');
        console.log('Event ID:', res.data.id);
        console.log('Event Link:', res.data.htmlLink);
        console.log('\n[Conclusion]:');
        console.log('Your service account HAS sharing permissions for this calendar!');
    } catch (error: any) {
        console.error('✗ Failed to insert simple event:', error.message);
        console.log('\n[Fix]:');
        console.log('To fix the Not Found error, you MUST share your Google Calendar with the Service Account email.');
        console.log('Please follow these steps:');
        console.log(`1. Open Google Calendar (https://calendar.google.com) for "${customCalendarId}".`);
        console.log('2. Click the three dots next to your calendar, and go to "Settings and sharing".');
        console.log('3. Scroll down to "Share with specific people or groups".');
        console.log('4. Click "Add people and groups" and enter the Service Account email:');
        console.log(`   --> ${email}`);
        console.log('5. Select the Permission: "Make changes to events" or "Make changes and manage sharing".');
        console.log('6. Click Send and then test again.');
    }
}

run();
