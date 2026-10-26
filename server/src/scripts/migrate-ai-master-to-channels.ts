/**
 * One-time migration for per-channel AI controls. The old "turn all AI off" master switch is retired: each AI
 * (WhatsApp, website chat, chat summaries) has its own switch and schedules. If the master switch is currently
 * OFF, copy that into the per-channel switches (so nothing starts answering by surprise) and set master back to ON.
 *
 *   npx tsx src/scripts/migrate-ai-master-to-channels.ts            # dry run (default)
 *   npx tsx src/scripts/migrate-ai-master-to-channels.ts --commit   # write
 */
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import AiSettingsModel from '../models/ai-settings.model.js';

const COMMIT = process.argv.includes('--commit');

async function main() {
    await mongoose.connect(envConfig.mongo_uri, { dbName: envConfig.db_name });
    const doc = await AiSettingsModel.findOne({ key: 'global' });
    if (!doc) {
        console.log('No AI settings document: nothing to migrate.');
    } else if (doc.masterMode !== 'off') {
        console.log('Master switch is already on: nothing to migrate.');
    } else {
        console.log('Master switch is OFF. Per-channel switches would become: whatsapp=off, web_chat=off, chat_summary=off; master=on.');
        if (COMMIT) {
            doc.features = { whatsapp: { enabled: false }, web_chat: { enabled: false }, chat_summary: { enabled: false } };
            doc.masterMode = 'on';
            await doc.save();
            console.log('Done.');
        } else {
            console.log('Dry run: pass --commit to write.');
        }
    }
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
