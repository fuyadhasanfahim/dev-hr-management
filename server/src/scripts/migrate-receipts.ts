/**
 * Migration: Convert old Receipt documents to the new schema
 *
 * Old schema: one Receipt per payment transaction
 * New schema: one Receipt per quotation (ledger) + ReceiptPayment per transaction
 *
 * Run: npx tsx src/scripts/migrate-receipts.ts
 */

import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || '';

// ── Inline schemas for migration (avoid importing changed models) ─────────────

const oldReceiptSchema = new mongoose.Schema({
    receiptNumber: String,
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
    quotationGroupId: String,
    quotationNumber: String,
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    clientName: String,
    projectTitle: String,
    category: String,
    currency: String,
    paymentType: String,
    milestoneLabel: String,
    amount: Number,
    paymentDate: Date,
    method: String,
    note: String,
    status: String,
    voidReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, strict: false });

// Use a temporary collection view to avoid conflicts with new model
const OldReceipt = mongoose.model('ReceiptMigration', oldReceiptSchema, 'receipts');

const receiptPaymentSchema = new mongoose.Schema({
    receiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt' },
    paymentType: String,
    milestoneLabel: String,
    amount: Number,
    paymentDate: Date,
    method: String,
    note: String,
    status: String,
    voidReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const ReceiptPayment = mongoose.model('ReceiptPayment', receiptPaymentSchema);

const newReceiptSchema = new mongoose.Schema({
    receiptNumber: String,
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
    quotationGroupId: String,
    quotationNumber: String,
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    clientName: String,
    projectTitle: String,
    category: String,
    currency: String,
    totalPaid: { type: Number, default: 0 },
    paymentStatus: { type: String, default: 'pending' },
    paymentHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReceiptPayment' }],
    status: String,
    voidReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, strict: false });

const NewReceipt = mongoose.model('ReceiptNew', newReceiptSchema, 'receipts');

async function migrate() {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all old-style receipt docs (they have an `amount` field directly)
    const allOld = await OldReceipt.find({ amount: { $exists: true } }).lean();
    console.log(`📋 Found ${allOld.length} old receipt documents to migrate`);

    // Group by quotationGroupId
    const grouped = new Map<string, typeof allOld>();
    for (const r of allOld) {
        const gid = r.quotationGroupId as string;
        if (!grouped.has(gid)) grouped.set(gid, []);
        grouped.get(gid)!.push(r);
    }

    console.log(`📦 Grouped into ${grouped.size} quotation receipt ledgers`);

    let migratedLedgers = 0;
    let migratedPayments = 0;

    for (const [groupId, receipts] of grouped.entries()) {
        // Sort oldest first so we keep the original receiptNumber from first record
        receipts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const primary = receipts[0];
        if (!primary) continue;

        // Determine which receipts were real payments (amount > 0, not void)
        const paymentReceipts = receipts.filter((r) => (r.amount as number) > 0);
        const isVoid = receipts.every((r) => r.status === 'void');

        // Build ReceiptPayment documents for each non-zero payment
        const paymentIds: Types.ObjectId[] = [];
        let totalPaid = 0;

        for (const pr of paymentReceipts) {
            const entryStatus = pr.status === 'void' ? 'void' : 'recorded';
            const entry = new ReceiptPayment({
                receiptId: primary._id,
                paymentType: pr.paymentType || 'partial',
                ...(pr.milestoneLabel ? { milestoneLabel: pr.milestoneLabel } : {}),
                amount: pr.amount,
                paymentDate: pr.paymentDate || pr.createdAt,
                ...(pr.method ? { method: pr.method } : {}),
                ...(pr.note ? { note: pr.note } : {}),
                status: entryStatus,
                ...(pr.voidReason ? { voidReason: pr.voidReason } : {}),
                createdBy: pr.createdBy,
                createdAt: pr.createdAt,
                updatedAt: pr.updatedAt,
            });
            await entry.save();
            paymentIds.push(entry._id as Types.ObjectId);
            if (entryStatus === 'recorded') totalPaid += pr.amount as number;
            migratedPayments++;
        }

        // Derive paymentStatus
        let paymentStatus = 'pending';
        if (isVoid) {
            paymentStatus = 'void';
        } else if (totalPaid > 0) {
            paymentStatus = 'partial'; // We don't have grandTotal here; set to partial as safe default
        }

        // Update the primary receipt document in-place to new schema
        await NewReceipt.updateOne(
            { _id: primary._id },
            {
                $set: {
                    totalPaid,
                    paymentStatus,
                    paymentHistory: paymentIds,
                    status: isVoid ? 'void' : 'issued',
                },
                $unset: {
                    // Remove old per-payment fields
                    amount: '',
                    paymentType: '',
                    milestoneLabel: '',
                    paymentDate: '',
                    method: '',
                    note: '',
                },
            },
        );
        migratedLedgers++;

        // Delete the duplicate receipt documents (all except primary)
        const dupeIds = receipts.slice(1).map((r) => r._id);
        if (dupeIds.length > 0) {
            await NewReceipt.deleteMany({ _id: { $in: dupeIds } });
            console.log(`  🗑️  Removed ${dupeIds.length} duplicate receipt(s) for group ${groupId}`);
        }

        console.log(
            `  ✅ Ledger ${primary.receiptNumber} | ${paymentIds.length} payments | totalPaid: ${totalPaid}`,
        );
    }

    console.log(`\n🎉 Migration complete: ${migratedLedgers} ledgers, ${migratedPayments} payment entries`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
