/**
 * Production migration: BACKUP FIRST, then backfill `category`.
 *
 * Steps (executed strictly in order — aborts immediately if any step fails):
 *   1. BACKUP   — export the full `quotations` and `quotationtemplates`
 *                 collections to timestamped, pretty-printed JSON files under
 *                 <server>/backups/. If the backup fails, the migration does
 *                 NOT run.
 *   2. MIGRATE  — set category = 'web-development' on every quotation and
 *                 quotation template that has no usable category (missing/null).
 *                 Category only — no totals/pricing/other fields are touched.
 *   3. VERIFY   — re-count documents still lacking a category and print a
 *                 final summary.
 *
 * Run: npx tsx src/scripts/backup-and-migrate-category.ts
 *
 * SAFE TO RUN MULTIPLE TIMES:
 *   - The backup always runs and is written to a fresh timestamped file
 *     (previous backups are never overwritten or deleted).
 *   - The migration filter only matches documents whose category is
 *     missing/null, so a second run reports "Nothing to migrate".
 *
 * NOTE: backups are JSON snapshots of the raw documents as returned by the
 * driver (ObjectId/Date are serialized to their string forms). They are a
 * safety net for inspection/manual restore, not an EJSON dump.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir, writeFile } from 'fs/promises';
import dotenv from 'dotenv';
import '../lib/dns-init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connect, disconnect } from 'mongoose';
import QuotationModel from '../models/quotation.model.js';
import QuotationTemplateModel from '../models/quotation-template.model.js';

const DEFAULT_CATEGORY = 'web-development';

// Matches documents that have no usable category yet (Phase 1 backfill filter).
const MISSING_CATEGORY_FILTER = {
    $or: [{ category: { $exists: false } }, { category: null }],
};

// Backups live at <server>/backups (i.e. ./backups when run from the server dir).
const BACKUP_DIR = path.join(__dirname, '../../backups');

/** Filesystem-safe ISO timestamp (no ':' or '.'). */
function timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Export one collection to a pretty-printed JSON file.
 * Throws if the read or the file write fails (caller aborts before migrating).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function backupCollection(Model: any, stamp: string) {
    const name: string = Model.collection.collectionName;
    const docs = await Model.collection.find({}).toArray();
    const file = path.join(BACKUP_DIR, `${name}-${stamp}.json`);
    await writeFile(file, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`[backup] ${name}: ${docs.length} document(s) → ${file}`);
    return { file, count: docs.length };
}

/** Backfill category on documents that lack one. Returns matched/modified. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function migrateCollection(label: string, Model: any) {
    const pending = await Model.countDocuments(MISSING_CATEGORY_FILTER);
    if (pending === 0) {
        console.log(`[migrate] ${label}: Nothing to migrate.`);
        return { matched: 0, modified: 0 };
    }
    const result = await Model.updateMany(MISSING_CATEGORY_FILTER, {
        $set: { category: DEFAULT_CATEGORY },
    });
    console.log(
        `[migrate] ${label}: matched ${result.matchedCount}, modified ${result.modifiedCount} (category='${DEFAULT_CATEGORY}').`,
    );
    return { matched: result.matchedCount, modified: result.modifiedCount };
}

async function run() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI not set in environment');

    console.log('Connecting to MongoDB...');
    await connect(mongoUri);
    console.log('Connected.\n');

    // ── STEP 1: BACKUP FIRST (must fully succeed before any migration) ────────
    const stamp = timestamp();
    await mkdir(BACKUP_DIR, { recursive: true });
    console.log(`Backing up collections to: ${BACKUP_DIR}\n`);
    const quotationBackup = await backupCollection(QuotationModel, stamp);
    const templateBackup = await backupCollection(QuotationTemplateModel, stamp);
    console.log('Backup complete.\n');

    // ── STEP 2: MIGRATE (only reached if both backups succeeded) ──────────────
    console.log('Backfilling category...');
    const quotationMigration = await migrateCollection(
        'quotations',
        QuotationModel,
    );
    const templateMigration = await migrateCollection(
        'quotationtemplates',
        QuotationTemplateModel,
    );
    console.log('');

    // ── STEP 3: VERIFY ────────────────────────────────────────────────────────
    const quotationRemaining = await QuotationModel.countDocuments(
        MISSING_CATEGORY_FILTER,
    );
    const templateRemaining = await QuotationTemplateModel.countDocuments(
        MISSING_CATEGORY_FILTER,
    );

    if (quotationRemaining > 0 || templateRemaining > 0) {
        console.warn(
            `WARNING: documents still lacking a category — quotations: ${quotationRemaining}, quotationtemplates: ${templateRemaining}. Manual review required.`,
        );
    } else {
        console.log('Verification passed: every document has a category.');
    }

    // ── Final summary ──────────────────────────────────────────────────────────
    console.log('\n──────────────── SUMMARY ────────────────');
    console.log('Backup files:');
    console.log(`  ${quotationBackup.file}`);
    console.log(`  ${templateBackup.file}`);
    console.log(
        `Documents backed up: quotations=${quotationBackup.count}, quotationtemplates=${templateBackup.count}`,
    );
    console.log(
        `Documents migrated:  quotations=${quotationMigration.modified}, quotationtemplates=${templateMigration.modified}`,
    );
    console.log('──────────────────────────────────────────');

    await disconnect();
    console.log('\nDisconnected from MongoDB.');
}

run().catch(async (err) => {
    console.error('\nABORTED — step failed, migration not completed:', err);
    // Best-effort disconnect; never let cleanup mask the original failure.
    try {
        await disconnect();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
