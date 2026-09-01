/**
 * One-off backfill: reconcile telemarketer commission for every existing
 * earning.
 *
 * Commission crediting was silently disconnected when earning.service.ts was
 * rewritten around receipts (commit 910910e). Earnings created since then never
 * paid their 5% telemarketer commission. This walks every earning and brings
 * its commission in line with `commission.service.reconcileEarningCommission`
 * — the same code path new payments now use, so it is safe to re-run.
 *
 * Usage:
 *   tsx src/scripts/backfill-telemarketer-commission.ts            # DRY RUN (no writes)
 *   tsx src/scripts/backfill-telemarketer-commission.ts --apply    # write changes
 */
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import EarningModel from '../models/earning.model.js';
import WalletTransactionModel, {
    TransactionType,
} from '../models/wallet-transaction.model.js';
import { getTelemarketerStaff } from '../utils/telemarketer.util.js';
import commissionService from '../services/commission.service.js';
// Register models referenced only via populate()/refs so this stand-alone
// script has them available the way the running server does.
import '../models/client.model.js';
import '../models/staff.model.js';

const APPLY = process.argv.includes('--apply');
const RATE = commissionService.COMMISSION_RATE;
const round2 = (n: number) => Math.round(n * 100) / 100;

type Row = {
    earningId: string;
    client: string;
    staff: string;
    gross: number;
    desired: number;
    previous: number;
    delta: number;
};

const run = async () => {
    console.log(`\nTelemarketer commission backfill — ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`);
    await mongoose.connect(envConfig.mongo_uri as string);
    console.log('Connected.\n');

    const earnings = await EarningModel.find().populate('clientId').lean();
    console.log(`Scanning ${earnings.length} earning(s)...\n`);

    const changes: Row[] = [];
    const skipped: { reason: string; count: number }[] = [];
    const bump = (reason: string) => {
        const e = skipped.find((s) => s.reason === reason);
        if (e) e.count++;
        else skipped.push({ reason, count: 1 });
    };

    let credited = 0;
    let clawedBack = 0;
    let failures = 0;

    for (const earning of earnings) {
        const client = earning.clientId as any;
        if (!client || !client.createdBy) {
            bump('no client / client.createdBy');
            continue;
        }

        const ownerUserId = String(client.assignedTelemarketer || client.createdBy);
        const staff = await getTelemarketerStaff(ownerUserId);
        if (!staff) {
            bump("client owner isn't a telemarketer");
            continue;
        }

        const gross = (earning.payments || []).reduce(
            (sum: number, p: any) => sum + (p.amount || 0),
            0,
        );
        const desired = round2(gross * RATE);

        const existing = await WalletTransactionModel.find({
            'metadata.earningId': new mongoose.Types.ObjectId(String(earning._id)),
            type: TransactionType.COMMISSION,
            status: 'completed',
        }).lean();
        const previous = round2(existing.reduce((s, t) => s + t.amount, 0));

        const delta = round2(desired - previous);
        if (Math.abs(delta) < 0.01) {
            bump('already correct');
            continue;
        }

        const row: Row = {
            earningId: String(earning._id),
            client: client.name || '—',
            staff: (staff as any).staffId || String(staff._id),
            gross,
            desired,
            previous,
            delta,
        };
        changes.push(row);

        if (APPLY) {
            try {
                await commissionService.reconcileEarningCommission(row.earningId);
                if (delta > 0) credited += delta;
                else clawedBack += -delta;
            } catch (err) {
                failures++;
                console.error(`  ! ${row.earningId} failed:`, (err as Error).message);
            }
        } else {
            if (delta > 0) credited += delta;
            else clawedBack += -delta;
        }
    }

    console.log('--- Earnings needing an adjustment ---');
    for (const r of changes) {
        console.log(
            `  ${r.earningId}  ${r.staff.padEnd(10)}  ${r.client.slice(0, 24).padEnd(24)}  ` +
                `gross ৳${r.gross.toLocaleString().padStart(12)}  ` +
                `was ৳${r.previous.toLocaleString().padStart(10)}  ->  ${r.delta > 0 ? '+' : ''}৳${r.delta.toLocaleString()}`,
        );
    }
    if (changes.length === 0) console.log('  (none)');

    console.log('\n--- Skipped ---');
    for (const s of skipped) console.log(`  ${s.count.toString().padStart(5)}  ${s.reason}`);

    console.log('\n--- Totals ---');
    console.log(`  earnings needing change : ${changes.length}`);
    console.log(`  to credit               : ৳${round2(credited).toLocaleString()}`);
    console.log(`  to claw back            : ৳${round2(clawedBack).toLocaleString()}`);
    console.log(`  net balance impact      : ৳${round2(credited - clawedBack).toLocaleString()}`);
    if (APPLY) console.log(`  write failures          : ${failures}`);

    console.log(
        APPLY
            ? '\nDone. Changes written.\n'
            : '\nDRY RUN — nothing written. Re-run with --apply to commit these.\n',
    );

    await mongoose.disconnect();
    process.exit(APPLY && failures > 0 ? 1 : 0);
};

run().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
