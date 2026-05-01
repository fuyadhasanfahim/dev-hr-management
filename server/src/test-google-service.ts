import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import googleCalendarService from './services/google-calendar.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function test() {
    try {
        console.log('Testing createMeetingEvent directly...');
        const result = await googleCalendarService.createMeetingEvent(
            'Test Meeting with Meet Link',
            'Testing Meet generation from our service',
            new Date(Date.now() + 60 * 60 * 1000),
            new Date(Date.now() + 90 * 60 * 1000),
            ['fuyadhasanfahim179@gmail.com']
        );
        console.log('✓ Success!', result);
    } catch (err: any) {
        console.error('✗ Failed:', err.message);
    }
}

test();
