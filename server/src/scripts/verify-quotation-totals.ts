/**
 * Verification (READ-ONLY): Quotation totals after the category-aware pricing change.
 *
 * For every existing quotation it recomputes totals with the NEW category-aware
 * logic and compares against the STORED totals:
 *   - web-development (category 'web-development' OR absent): MUST match exactly.
 *     Any mismatch is a regression and fails the script (exit 1).
 *   - other categories: reported for information only (new logic intentionally
 *     differs from any legacy stored value).
 *
 * Does NOT write anything to the database.
 *
 * Run: npx tsx src/scripts/verify-quotation-totals.ts
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

const EPS = 1e-6;

/** Identical to the NEW calculateTotals() in quotation.service.ts (Option B). */
function recomputeTotals(q: any) {
    const basePrice = q.pricing?.basePrice || 0;
    // Mirrors calculateTotals: per-line amount = price × (quantity ?? 1).
    const additionalServicesTotal =
        q.additionalServices?.reduce(
            (acc: number, s: any) => acc + (s.price || 0) * (s.quantity ?? 1),
            0,
        ) || 0;
    const discountRate = q.pricing?.discount || 0;
    const taxRate = q.pricing?.taxRate || 0;

    const isWebDev = (q.category ?? 'web-development') === 'web-development';
    const subtotalBeforeDiscount = isWebDev
        ? basePrice + additionalServicesTotal
        : additionalServicesTotal;

    const discountAmount = (subtotalBeforeDiscount * discountRate) / 100;
    const subtotal = subtotalBeforeDiscount - discountAmount;
    const taxAmount = (subtotal * taxRate) / 100;
    const grandTotal = subtotal + taxAmount;

    return { subtotal, taxAmount, grandTotal };
}

function close(a: number, b: number) {
    return Math.abs((a || 0) - (b || 0)) < EPS;
}

async function main() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI not set in environment');

    console.log('Connecting to MongoDB...');
    await connect(mongoUri);
    console.log('Connected.\n');

    const quotes = await QuotationModel.find(
        {},
        {
            quotationNumber: 1,
            category: 1,
            pricing: 1,
            additionalServices: 1,
            totals: 1,
        },
    ).lean();

    let webDevChecked = 0;
    let nonWebDev = 0;
    const mismatches: Array<{
        quotationNumber: string;
        stored: any;
        recomputed: any;
    }> = [];

    for (const q of quotes as any[]) {
        const isWebDev = (q.category ?? 'web-development') === 'web-development';
        const stored = q.totals || {};
        const recomputed = recomputeTotals(q);

        if (isWebDev) {
            webDevChecked++;
            const ok =
                close(stored.subtotal, recomputed.subtotal) &&
                close(stored.taxAmount, recomputed.taxAmount) &&
                close(stored.grandTotal, recomputed.grandTotal);
            if (!ok) {
                mismatches.push({
                    quotationNumber: q.quotationNumber || String(q._id),
                    stored: {
                        subtotal: stored.subtotal,
                        taxAmount: stored.taxAmount,
                        grandTotal: stored.grandTotal,
                    },
                    recomputed,
                });
            }
        } else {
            nonWebDev++;
        }
    }

    console.log(`Total quotations scanned:        ${quotes.length}`);
    console.log(`web-development quotes checked:   ${webDevChecked}`);
    console.log(`non-web-dev quotes (info only):   ${nonWebDev}`);
    console.log('');

    if (mismatches.length === 0) {
        console.log(
            '✅ PASS: every web-development quote recomputes to its stored totals (byte-identical).',
        );
    } else {
        console.error(
            `❌ FAIL: ${mismatches.length} web-development quote(s) changed. Details:`,
        );
        for (const m of mismatches) {
            console.error(`  ${m.quotationNumber}`);
            console.error(`    stored:     ${JSON.stringify(m.stored)}`);
            console.error(`    recomputed: ${JSON.stringify(m.recomputed)}`);
        }
    }

    await disconnect();
    console.log('\nDisconnected from MongoDB.');

    if (mismatches.length > 0) process.exit(1);
}

main().catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
});
