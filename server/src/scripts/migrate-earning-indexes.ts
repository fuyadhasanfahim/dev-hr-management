/**
 * One-off: photo-invoice earnings have no receipt, so the unique `receiptId` index must be partial.
 * Drops the old full-unique index (if it is still the old shape) and lets Mongoose build the new ones.
 *
 *   npx tsx src/scripts/migrate-earning-indexes.ts
 */
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import EarningModel from '../models/earning.model.js';

await mongoose.connect(envConfig.mongo_uri as string);
const indexes = await EarningModel.collection.indexes();
const old = indexes.find((i) => i.name === 'receiptId_1' && !i.partialFilterExpression);
if (old) {
    await EarningModel.collection.dropIndex('receiptId_1');
    console.log('dropped old receiptId_1 (full unique)');
}
await EarningModel.createIndexes();
console.log((await EarningModel.collection.indexes()).filter((i) => /receiptId|photoInvoiceId/.test(String(i.name))).map((i) => ({ name: i.name, unique: i.unique, partial: !!i.partialFilterExpression })));
await mongoose.disconnect();
