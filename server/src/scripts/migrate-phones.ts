import { connect, connection } from 'mongoose';
import envConfig from '../config/env.config.js';
import ClientModel from '../models/client.model.js';
import MeetingModel from '../models/meeting.model.js';
import { parseAndFormatPhone } from '../services/meeting.service.js';

async function runMigration() {
    console.log('🚀 Starting Phone Number Format Migration...');
    try {
        await connect(envConfig.mongo_uri);
        console.log('✅ Database connected successfully.\n');

        // --- 1. Migrate Client Phone Numbers ---
        console.log('--- Migrating Client Phone Numbers ---');
        const clients = await ClientModel.find({});
        let migratedClientsCount = 0;

        for (const client of clients) {
            if (client.phone) {
                const parsed = parseAndFormatPhone(client.phone);
                if (parsed.isValid && parsed.formatted !== client.phone) {
                    console.log(`[Client] Updating "${client.name}" phone: ${client.phone} ➡️ ${parsed.formatted}`);
                    client.phone = parsed.formatted;
                    await client.save();
                    migratedClientsCount++;
                }
            }
        }
        console.log(`✅ Client phone migration completed. Updated ${migratedClientsCount} clients.\n`);

        // --- 2. Migrate Meeting Attendee Phone Numbers ---
        console.log('--- Migrating Meeting Attendee Phone Numbers ---');
        const meetings = await MeetingModel.find({});
        let migratedMeetingsCount = 0;

        for (const meeting of meetings) {
            const rawPhones = meeting.attendeePhones || [];
            if (rawPhones.length > 0) {
                const parsedPhones = rawPhones
                    .map((phone) => parseAndFormatPhone(phone))
                    .filter((parsed) => parsed.isValid)
                    .map((parsed) => parsed.formatted);

                // Check if any numbers actually changed or were filtered
                const hasChanged = rawPhones.length !== parsedPhones.length || 
                    rawPhones.some((p, index) => p !== parsedPhones[index]);

                if (hasChanged) {
                    console.log(`[Meeting] Updating "${meeting.meetingTitle}" attendeePhones: [${rawPhones.join(', ')}] ➡️ [${parsedPhones.join(', ')}]`);
                    meeting.attendeePhones = parsedPhones;
                    await meeting.save();
                    migratedMeetingsCount++;
                }
            }
        }
        console.log(`✅ Meeting phone migration completed. Updated ${migratedMeetingsCount} meetings.\n`);

        console.log('🎉 Phone Number Format Migration successfully completed!');
    } catch (err: any) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await connection.close();
        console.log('🔌 Database connection closed.');
        process.exit(0);
    }
}

runMigration();
