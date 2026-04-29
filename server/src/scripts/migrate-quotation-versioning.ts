/**
 * Migration: Backfill Quotation Versioning Fields
 *
 * Adds quotationGroupId, version, and isLatestVersion to all existing quotation documents
 * that were created before the versioning system was introduced.
 *
 * Run: npx tsx src/scripts/migrate-quotation-versioning.ts
 *
 * SAFE TO RUN MULTIPLE TIMES — uses $setOnInsert-like logic via $exists checks.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connect, disconnect } from 'mongoose';
import QuotationModel from '../models/quotation.model.js';

async function migrate() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI not set in environment');

    console.log('Connecting to MongoDB...');
    await connect(mongoUri);
    console.log('Connected.\n');

    // Find all quotations that do not yet have quotationGroupId set
    const unmigratedCount = await QuotationModel.countDocuments({
        quotationGroupId: { $exists: false },
    });

    console.log(`Found ${unmigratedCount} quotation(s) to migrate.`);

    if (unmigratedCount === 0) {
        console.log('Nothing to migrate. All quotations already have versioning fields.');
        await disconnect();
        return;
    }

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 100;
    let processed = 0;

    const cursor = QuotationModel.find(
        { quotationGroupId: { $exists: false } },
        { _id: 1 },
    ).cursor();

    const bulkOps: any[] = [];

    for await (const doc of cursor) {
        /**
         * Each pre-existing quotation becomes:
         *  - quotationGroupId = its own _id (so each is its own independent group)
         *  - version = 1
         *  - isLatestVersion = true
         *
         * This is safe because pre-existing quotations have no sibling versions.
         */
        bulkOps.push({
            updateOne: {
                filter: { _id: doc._id, quotationGroupId: { $exists: false } },
                update: {
                    $set: {
                        quotationGroupId: doc._id.toString(),
                        version: 1,
                        isLatestVersion: true,
                    },
                },
            },
        });

        if (bulkOps.length >= BATCH_SIZE) {
            const result = await QuotationModel.bulkWrite(bulkOps);
            processed += result.modifiedCount;
            console.log(`  Batch complete. Modified: ${result.modifiedCount}. Total so far: ${processed}`);
            bulkOps.length = 0;
        }
    }

    // Process remaining ops
    if (bulkOps.length > 0) {
        const result = await QuotationModel.bulkWrite(bulkOps);
        processed += result.modifiedCount;
        console.log(`  Final batch complete. Modified: ${result.modifiedCount}.`);
    }

    console.log(`\nMigration complete. Total quotations migrated: ${processed}`);

    // Verify
    const remaining = await QuotationModel.countDocuments({
        quotationGroupId: { $exists: false },
    });
    if (remaining > 0) {
        console.warn(`WARNING: ${remaining} quotation(s) still lack quotationGroupId. Manual review required.`);
    } else {
        console.log('Verification passed: All quotations have versioning fields.');
    }

    await disconnect();
    console.log('Disconnected from MongoDB.');
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
