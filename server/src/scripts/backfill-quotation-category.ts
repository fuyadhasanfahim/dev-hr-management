/**
 * Migration: Backfill `category` on Quotations and Quotation Templates
 *
 * Sets category = 'web-development' on every existing quotation AND quotation
 * template that does not already have a category (missing or null). Documents
 * that already carry a category are left untouched.
 *
 * Run: npx tsx src/scripts/backfill-quotation-category.ts
 *
 * SAFE TO RUN MULTIPLE TIMES — the filter only matches documents whose
 * category is missing/null, so a second run is a no-op.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import '../lib/dns-init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connect, disconnect } from 'mongoose';
import QuotationModel from '../models/quotation.model.js';
import QuotationTemplateModel from '../models/quotation-template.model.js';

const DEFAULT_CATEGORY = 'web-development';

// Matches documents that have no usable category yet.
const MISSING_CATEGORY_FILTER = {
    $or: [{ category: { $exists: false } }, { category: null }],
};

async function backfillCollection(
    label: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Model: any,
): Promise<void> {
    const pending = await Model.countDocuments(MISSING_CATEGORY_FILTER);
    console.log(`[${label}] Found ${pending} document(s) without a category.`);

    if (pending === 0) {
        console.log(`[${label}] Nothing to backfill.`);
        return;
    }

    const result = await Model.updateMany(MISSING_CATEGORY_FILTER, {
        $set: { category: DEFAULT_CATEGORY },
    });

    console.log(
        `[${label}] Backfilled category='${DEFAULT_CATEGORY}'. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}.`,
    );

    // Verify
    const remaining = await Model.countDocuments(MISSING_CATEGORY_FILTER);
    if (remaining > 0) {
        console.warn(`[${label}] WARNING: ${remaining} document(s) still lack a category. Manual review required.`);
    } else {
        console.log(`[${label}] Verification passed: every document has a category.`);
    }
}

async function migrate() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI not set in environment');

    console.log('Connecting to MongoDB...');
    await connect(mongoUri);
    console.log('Connected.\n');

    await backfillCollection('QuotationTemplate', QuotationTemplateModel);
    console.log('');
    await backfillCollection('Quotation', QuotationModel);

    await disconnect();
    console.log('\nDisconnected from MongoDB.');
}

migrate().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
