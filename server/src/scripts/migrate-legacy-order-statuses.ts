/**
 * Migration: Normalize legacy order statuses to the simplified 6-status model
 *
 * The order status pipeline used to include payment-gated intermediate statuses
 * (pending_upfront, active, quality_check, pending_delivery, pending_final) plus
 * two never-reachable ones (awaiting_approval, approved). That pipeline was never
 * actually automated (no payment webhook ever drove it), so it has been retired.
 * This backfills any order still sitting in one of the old statuses to the closest
 * status in the new set: pending, in_progress, revision, completed, delivered, cancelled.
 *
 * Only the top-level `status` field is rewritten — `statusHistory` entries are left
 * untouched as an immutable audit trail of what actually happened.
 *
 * Run: npx tsx src/scripts/migrate-legacy-order-statuses.ts
 *
 * SAFE TO RUN MULTIPLE TIMES — each mapped status is only matched (and moved) once;
 * a second run finds nothing left to migrate.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import '../lib/dns-init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connect, disconnect } from 'mongoose';
import OrderModel from '../models/order.model.js';

// Legacy status -> new status
const STATUS_MAP: Record<string, string> = {
    pending_upfront: 'pending',
    active: 'in_progress',
    quality_check: 'in_progress',
    pending_delivery: 'in_progress',
    pending_final: 'delivered',
    awaiting_approval: 'pending',
    approved: 'in_progress',
};

async function migrate() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI not set in environment');

    console.log('Connecting to MongoDB...');
    await connect(mongoUri);
    console.log('Connected.\n');

    console.log('Current status distribution:');
    const before = await OrderModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);
    console.table(before.map((r) => ({ status: r._id, count: r.count })));

    for (const [legacyStatus, newStatus] of Object.entries(STATUS_MAP)) {
        const pending = await OrderModel.countDocuments({ status: legacyStatus });
        if (pending === 0) {
            console.log(`[${legacyStatus}] Nothing to migrate.`);
            continue;
        }

        console.log(`[${legacyStatus}] Found ${pending} order(s). Migrating to '${newStatus}'...`);
        const result = await OrderModel.updateMany(
            { status: legacyStatus },
            { $set: { status: newStatus } },
        );
        console.log(
            `[${legacyStatus}] Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}.`,
        );
    }

    console.log('\nFinal status distribution:');
    const after = await OrderModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);
    console.table(after.map((r) => ({ status: r._id, count: r.count })));

    const stillLegacy = after.filter((r) => Object.keys(STATUS_MAP).includes(r._id));
    if (stillLegacy.length > 0) {
        console.warn('WARNING: some orders still carry a legacy status. Manual review required.');
    } else {
        console.log('Verification passed: no legacy statuses remain.');
    }

    await disconnect();
    console.log('\nDisconnected from MongoDB.');
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
