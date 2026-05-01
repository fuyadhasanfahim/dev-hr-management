import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!email || !privateKey || !calendarId) {
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
        const res = await calendar.calendars.get({ calendarId });
        console.log('✓ Success! Calendar allowedConferenceSolutionTypes:', res.data.conferenceProperties?.allowedConferenceSolutionTypes);
    } catch (error: any) {
        console.error('✗ Error:', error.message);
    }
}

run();
