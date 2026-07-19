/**
 * Production migration: BACKUP FIRST, then convert legacy single-category
 * quotations (category + pricing + additionalServices + phases + techStack)
 * into the new multi-service shape (services: IQuotationService[]).
 *
 * Steps (executed strictly in order — aborts immediately if any step fails):
 *   1. BACKUP   — export the full `quotations` collection to a timestamped,
 *                 pretty-printed JSON file under <server>/backups/. If the
 *                 backup fails, the migration does NOT run.
 *   2. MIGRATE  — for every quotation that has no `services` array yet, build
 *                 a single-entry `services[]` from its legacy category/pricing/
 *                 additionalServices/phases/techStack fields, and flatten any
 *                 monthly/yearly additionalServices into `recurringCharges`.
 *                 Legacy fields are left in place (unused by the app going
 *                 forward, but not deleted here — safe to drop in a later pass
 *                 once this migration is verified in production).
 *   3. VERIFY   — re-count documents still lacking a `services` array and
 *                 print a final summary.
 *
 * Run: npx tsx src/scripts/migrate-quotation-services.ts
 *
 * SAFE TO RUN MULTIPLE TIMES:
 *   - The backup always runs and is written to a fresh timestamped file
 *     (previous backups are never overwritten or deleted).
 *   - The migration filter only matches documents whose `services` is
 *     missing/empty, so a second run reports "Nothing to migrate".
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

const UPFRONT_CYCLES = new Set(['one-time', 'per-image', 'per-video', 'per-second', 'per-10s']);

// Matches documents that haven't been migrated to the services[] shape yet.
const NOT_MIGRATED_FILTER = {
    $or: [{ services: { $exists: false } }, { services: { $size: 0 } }],
};

// Backups live at <server>/backups (i.e. ./backups when run from the server dir).
const BACKUP_DIR = path.join(__dirname, '../../backups');

/** Filesystem-safe ISO timestamp (no ':' or '.'). */
function timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

async function backupCollection(stamp: string) {
    const name = QuotationModel.collection.collectionName;
    const docs = await QuotationModel.collection.find({}).toArray();
    const file = path.join(BACKUP_DIR, `${name}-${stamp}.json`);
    await writeFile(file, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`[backup] ${name}: ${docs.length} document(s) → ${file}`);
    return { file, count: docs.length };
}

/** Splits legacy additionalServices into this service's upfront lineItems + recurring charges. */
function splitLineItems(rawServices: any[]): {
    lineItems: any[];
    recurring: any[];
} {
    const lineItems: any[] = [];
    const recurring: any[] = [];
    for (const s of rawServices || []) {
        const item = {
            title: String(s?.title || 'Add-on Service'),
            price: Number(s?.price) || 0,
            billingCycle: s?.billingCycle || 'one-time',
            ...(typeof s?.quantity === 'number' ? { quantity: s.quantity } : {}),
            ...(s?.description ? { description: String(s.description) } : {}),
        };
        if (UPFRONT_CYCLES.has(item.billingCycle)) {
            lineItems.push(item);
        } else {
            recurring.push(item);
        }
    }
    return { lineItems, recurring };
}

/** Builds the single-entry services[] + top-level recurringCharges[] for one legacy doc. */
function buildServicesForDoc(doc: any): { services: any[]; recurringCharges: any[] } {
    const category = doc.category || 'web-development';
    const phases = Array.isArray(doc.phases) ? doc.phases : [];
    const developmentScope = Array.isArray(doc.developmentScope) ? doc.developmentScope : [];

    // Prefer the already-flattened `developmentScope` (stored as "[Phase Title] item"),
    // falling back to manually flattening `phases` if it's absent.
    const scopeItems: string[] =
        developmentScope.length > 0
            ? developmentScope
            : phases.flatMap((p: any) =>
                  (p?.items || []).map((item: string) => (p?.title ? `[${p.title}] ${item}` : item)),
              );

    const scopeDescription = phases[0]?.description || undefined;

    const { lineItems, recurring } = splitLineItems(doc.additionalServices);

    const rawTechStack = doc.techStack;
    const techStack =
        category === 'web-development' &&
        rawTechStack &&
        (rawTechStack.frontend || rawTechStack.backend || rawTechStack.database || (rawTechStack.tools || []).length > 0)
            ? {
                  frontend: rawTechStack.frontend ? [String(rawTechStack.frontend)] : [],
                  backend: rawTechStack.backend ? [String(rawTechStack.backend)] : [],
                  database: rawTechStack.database ? [String(rawTechStack.database)] : [],
                  tools: Array.isArray(rawTechStack.tools) ? rawTechStack.tools : [],
              }
            : undefined;

    const service = {
        category,
        ...(scopeDescription ? { scopeDescription } : {}),
        scopeItems,
        ...(techStack ? { techStack } : {}),
        basePrice: Number(doc.pricing?.basePrice) || 0,
        lineItems,
        discount: Number(doc.pricing?.discount) || 0,
        taxRate: Number(doc.pricing?.taxRate) || 0,
    };

    return { services: [service], recurringCharges: recurring };
}

async function migrateQuotations(): Promise<{ matched: number; modified: number }> {
    const legacyDocs = await QuotationModel.collection.find(NOT_MIGRATED_FILTER).toArray();
    if (legacyDocs.length === 0) {
        console.log('[migrate] quotations: Nothing to migrate.');
        return { matched: 0, modified: 0 };
    }

    let modified = 0;
    for (const doc of legacyDocs) {
        const { services, recurringCharges } = buildServicesForDoc(doc);
        await QuotationModel.collection.updateOne(
            { _id: doc._id },
            { $set: { services, recurringCharges } },
        );
        modified += 1;
    }

    console.log(`[migrate] quotations: matched ${legacyDocs.length}, modified ${modified}.`);
    return { matched: legacyDocs.length, modified };
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
    console.log(`Backing up collection to: ${BACKUP_DIR}\n`);
    const backup = await backupCollection(stamp);
    console.log('Backup complete.\n');

    // ── STEP 2: MIGRATE (only reached if backup succeeded) ────────────────────
    console.log('Migrating quotations to services[] shape...');
    const migration = await migrateQuotations();
    console.log('');

    // ── STEP 3: VERIFY ──────────────────────────────────────────────────────────
    const remaining = await QuotationModel.collection.countDocuments(NOT_MIGRATED_FILTER);

    if (remaining > 0) {
        console.warn(
            `WARNING: documents still lacking services[] — quotations: ${remaining}. Manual review required.`,
        );
    } else {
        console.log('Verification passed: every document has a services[] array.');
    }

    // ── Final summary ────────────────────────────────────────────────────────────
    console.log('\n──────────────── SUMMARY ────────────────');
    console.log('Backup file:');
    console.log(`  ${backup.file}`);
    console.log(`Documents backed up: quotations=${backup.count}`);
    console.log(`Documents migrated:  quotations=${migration.modified}`);
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
