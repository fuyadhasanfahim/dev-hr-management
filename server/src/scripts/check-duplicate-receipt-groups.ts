/**
 * E1-F3-T1 pre-deploy check (Subtask a): read-only report of any
 * `quotationGroupId` values with more than one Receipt.
 *
 * The upcoming unique index on Receipt.quotationGroupId cannot be created
 * while duplicates exist. Run this against production BEFORE deploying the
 * index change; if it reports any groups, reconcile them (Subtask b) first.
 *
 * This script makes no writes.
 */
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import ReceiptModel from '../models/receipt.model.js';

const run = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(envConfig.mongo_uri as string);
        console.log('Connected successfully.');

        const duplicates = await ReceiptModel.aggregate([
            { $group: { _id: '$quotationGroupId', count: { $sum: 1 }, receiptIds: { $push: '$_id' } } },
            { $match: { count: { $gt: 1 } } },
        ]);

        if (duplicates.length === 0) {
            console.log('No duplicate quotationGroupId values found. Safe to deploy the unique index.');
        } else {
            console.log(`Found ${duplicates.length} quotationGroupId value(s) with duplicate receipts:`);
            for (const d of duplicates) {
                console.log(`  quotationGroupId=${d._id} count=${d.count} receiptIds=${d.receiptIds.join(', ')}`);
            }
            console.log('Reconcile (merge/void) the above before deploying the unique index.');
        }

        process.exit(duplicates.length === 0 ? 0 : 1);
    } catch (error) {
        console.error('Duplicate check failed:', error);
        process.exit(1);
    }
};

run();
