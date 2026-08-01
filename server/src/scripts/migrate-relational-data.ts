import mongoose, { Types } from 'mongoose';
import envConfig from '../config/env.config.js';

// Import Models
import QuotationModel from '../models/quotation.model.js';
import QuotationServiceModel from '../models/quotation-service.model.js';
import QuotationLineItemModel from '../models/quotation-line-item.model.js';
import QuotationMilestoneModel from '../models/quotation-milestone.model.js';

import OrderModel from '../models/order.model.js';
import OrderAssetModel from '../models/order-asset.model.js';
import OrderStatusHistoryModel from '../models/order-status-history.model.js';

import OrderTaskModel from '../models/task.model.js';
import SubtaskModel from '../models/subtask.model.js';

import ReceiptModel from '../models/receipt.model.js';
import ReceiptPaymentModel from '../models/receipt-payment.model.js';

const runMigration = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(envConfig.mongo_uri as string);
        console.log('Connected successfully.');

        const db = mongoose.connection.db;
        if (!db) throw new Error('Database connection failed');

        // ---------------------------------------------------------
        // 1. Migrate Quotations
        // ---------------------------------------------------------
        console.log('\n--- Migrating Quotations ---');
        const rawQuotations = await db.collection('quotations').find({}).toArray();
        let qSvcsCount = 0, qLinesCount = 0, qMilesCount = 0;

        for (const q of rawQuotations) {
            const quotationId = q._id;

            if (q.services && Array.isArray(q.services)) {
                for (const svc of q.services) {
                    const svcId = svc._id || new Types.ObjectId();
                    const { lineItems, _id, ...svcData } = svc;
                    
                    // Upsert Service
                    await QuotationServiceModel.updateOne(
                        { _id: svcId },
                        { $set: { ...svcData, quotationId } },
                        { upsert: true }
                    );
                    qSvcsCount++;

                    // Upsert Line Items for Service
                    if (lineItems && Array.isArray(lineItems)) {
                        for (const li of lineItems) {
                            const liId = li._id || new Types.ObjectId();
                            const { _id: _ignore, ...liData } = li;
                            await QuotationLineItemModel.updateOne(
                                { _id: liId },
                                { $set: { ...liData, quotationServiceId: svcId, quotationId } },
                                { upsert: true }
                            );
                            qLinesCount++;
                        }
                    }
                }
            }

            if (q.recurringCharges && Array.isArray(q.recurringCharges)) {
                for (const rc of q.recurringCharges) {
                    const rcId = rc._id || new Types.ObjectId();
                    const { _id, ...rcData } = rc;
                    await QuotationLineItemModel.updateOne(
                        { _id: rcId },
                        { $set: { ...rcData, quotationId } },
                        { upsert: true }
                    );
                    qLinesCount++;
                }
            }

            if (q.paymentMilestones && Array.isArray(q.paymentMilestones)) {
                for (const m of q.paymentMilestones) {
                    const mId = m._id || new Types.ObjectId();
                    const { _id, ...mData } = m;
                    await QuotationMilestoneModel.updateOne(
                        { _id: mId },
                        { $set: { ...mData, quotationId } },
                        { upsert: true }
                    );
                    qMilesCount++;
                }
            }
        }

        // Cleanup legacy arrays on quotations
        await db.collection('quotations').updateMany({}, {
            $unset: { services: "", recurringCharges: "", paymentMilestones: "" }
        });
        console.log(`Migrated ${qSvcsCount} services, ${qLinesCount} line items, and ${qMilesCount} milestones from ${rawQuotations.length} quotations.`);

        // ---------------------------------------------------------
        // 2. Migrate Orders
        // ---------------------------------------------------------
        console.log('\n--- Migrating Orders ---');
        const rawOrders = await db.collection('orders').find({}).toArray();
        let oAssetsCount = 0, oHistoryCount = 0;

        for (const o of rawOrders) {
            const orderId = o._id;

            if (o.assets && Array.isArray(o.assets)) {
                for (const asset of o.assets) {
                    const assetId = asset._id || new Types.ObjectId();
                    const { _id, ...assetData } = asset;
                    await OrderAssetModel.updateOne(
                        { _id: assetId },
                        { $set: { ...assetData, orderId } },
                        { upsert: true }
                    );
                    oAssetsCount++;
                }
            }

            if (o.statusHistory && Array.isArray(o.statusHistory)) {
                for (const sh of o.statusHistory) {
                    const shId = sh._id || new Types.ObjectId();
                    const { _id, ...shData } = sh;
                    await OrderStatusHistoryModel.updateOne(
                        { _id: shId },
                        { $set: { ...shData, orderId } },
                        { upsert: true }
                    );
                    oHistoryCount++;
                }
            }
        }

        await db.collection('orders').updateMany({}, {
            $unset: { assets: "", statusHistory: "" }
        });
        console.log(`Migrated ${oAssetsCount} assets and ${oHistoryCount} status histories from ${rawOrders.length} orders.`);

        // ---------------------------------------------------------
        // 3. Migrate Tasks
        // ---------------------------------------------------------
        console.log('\n--- Migrating Tasks ---');
        const rawTasks = await db.collection('ordertasks').find({}).toArray();
        let tSubtasksCount = 0;

        for (const t of rawTasks) {
            const taskId = t._id;

            if (t.subtasks && Array.isArray(t.subtasks)) {
                for (const st of t.subtasks) {
                    const stId = st._id || new Types.ObjectId();
                    const { _id, ...stData } = st;
                    await SubtaskModel.updateOne(
                        { _id: stId },
                        { $set: { ...stData, taskId } },
                        { upsert: true }
                    );
                    tSubtasksCount++;
                }
            }
        }

        await db.collection('ordertasks').updateMany({}, {
            $unset: { subtasks: "" }
        });
        console.log(`Migrated ${tSubtasksCount} subtasks from ${rawTasks.length} tasks.`);

        // ---------------------------------------------------------
        // 4. Migrate Receipts
        // ---------------------------------------------------------
        console.log('\n--- Migrating Receipts ---');
        const rawReceipts = await db.collection('receipts').find({}).toArray();
        let rPaymentsCount = 0;

        for (const r of rawReceipts) {
            const receiptId = r._id;

            if (r.paymentHistory && Array.isArray(r.paymentHistory)) {
                for (const ph of r.paymentHistory) {
                    const phId = ph._id || new Types.ObjectId();
                    const { _id, ...phData } = ph;
                    await ReceiptPaymentModel.updateOne(
                        { _id: phId },
                        { $set: { ...phData, receiptId } },
                        { upsert: true }
                    );
                    rPaymentsCount++;
                }
            }
        }

        await db.collection('receipts').updateMany({}, {
            $unset: { paymentHistory: "" }
        });
        console.log(`Migrated ${rPaymentsCount} payments from ${rawReceipts.length} receipts.`);

        console.log('\n=== MIGRATION COMPLETE ===');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
