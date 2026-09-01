import mongoose, { type ClientSession } from "mongoose";
import StaffModel from "../models/staff.model.js";
import WalletTransactionModel, {
    TransactionType,
} from "../models/wallet-transaction.model.js";
import EarningModel from "../models/earning.model.js";
import { getTelemarketerStaff } from "../utils/telemarketer.util.js";

const COMMISSION_RATE = 0.05; // 5%

const round2 = (n: number): number => Math.round(n * 100) / 100;

type ReconcileResult = {
    earningId: string;
    staffId: mongoose.Types.ObjectId;
    delta: number;
    desired: number;
    previous: number;
} | null;

/**
 * Bring the telemarketer commission for one earning in line with what it
 * *should* be — `5% of the earning's recorded gross` — whatever it is now.
 *
 * This is the single entry point and it is fully idempotent:
 *  - first payment on a telemarketer's client  -> credits 5%
 *  - more payments land                        -> tops the commission up
 *  - a payment is voided (earning shrinks)     -> claws the difference back
 *  - every payment voided (earning deleted)    -> claws the whole thing back
 *  - run twice with nothing changed            -> no-op
 *
 * The adjustment is always a single signed `commission` wallet transaction
 * (positive = credit, negative = claw-back) plus a matching `$inc` on the
 * staff balance, so `sum(completed commission txns for an earning)` always
 * equals the commission actually paid for it.
 *
 * @param earningId     Earning to reconcile. May already be deleted — then the
 *                      target is 0 and any prior commission is clawed back.
 * @param actorUserId   User who triggered the change (audit only; optional).
 */
async function reconcileEarningCommission(
    earningId: string,
    actorUserId?: string,
    parentSession?: ClientSession,
): Promise<ReconcileResult> {
    const session = parentSession || (await mongoose.startSession());
    if (!parentSession) session.startTransaction();

    try {
        const earningObjectId = new mongoose.Types.ObjectId(earningId);

        // 1. What the commission SHOULD be right now.
        const earning = await EarningModel.findById(earningId)
            .populate("clientId")
            .session(session);

        const client = (earning?.clientId as any) || null;
        const totalGrossBDT = earning
            ? earning.payments.reduce((sum, p) => sum + (p.amount || 0), 0)
            : 0;
        const desired = round2(totalGrossBDT * COMMISSION_RATE);

        // 2. What has already been credited for this earning.
        const existing = await WalletTransactionModel.find({
            "metadata.earningId": earningObjectId,
            type: TransactionType.COMMISSION,
            status: "completed",
        }).session(session);
        const previous = round2(existing.reduce((sum, t) => sum + t.amount, 0));

        const delta = round2(desired - previous);
        if (Math.abs(delta) < 0.01) {
            if (!parentSession) await session.abortTransaction();
            return null;
        }

        // 3. Which telemarketer does this belong to? Reuse the staff already on
        //    a prior commission txn (works even after the earning is deleted);
        //    otherwise resolve from the client's owner / assignee.
        let staffId: mongoose.Types.ObjectId | null =
            (existing[0]?.staffId as mongoose.Types.ObjectId) ?? null;

        if (!staffId) {
            if (!client || !client.createdBy) {
                if (!parentSession) await session.abortTransaction();
                return null;
            }
            const ownerUserId = String(
                client.assignedTelemarketer || client.createdBy,
            );
            const staff = await getTelemarketerStaff(ownerUserId, session);
            if (!staff) {
                // Client isn't owned by a telemarketer — nothing to pay.
                if (!parentSession) await session.abortTransaction();
                return null;
            }
            staffId = staff._id as mongoose.Types.ObjectId;
        }

        const clientName =
            client?.name || existing[0]?.metadata?.clientName || "client";
        const period = earning ? ` (${earning.month}/${earning.year})` : "";
        const description =
            delta > 0
                ? `5% commission on ৳${totalGrossBDT.toLocaleString()} gross — ${clientName}${period}`
                : `Commission adjustment (payment voided) — ${clientName}${period}`;

        // 4. One signed transaction + matching balance move, atomically.
        await WalletTransactionModel.create(
            [
                {
                    staffId,
                    amount: delta,
                    type: TransactionType.COMMISSION,
                    status: "completed",
                    ...(actorUserId
                        ? { createdBy: new mongoose.Types.ObjectId(actorUserId) }
                        : {}),
                    description,
                    metadata: {
                        earningId: earningObjectId,
                        clientName,
                        totalGrossBDT,
                        commissionRate: COMMISSION_RATE,
                        reconciledTo: desired,
                        previousCommission: previous,
                        isAdjustment: previous > 0,
                    },
                },
            ],
            { session },
        );

        await StaffModel.updateOne(
            { _id: staffId },
            { $inc: { balance: delta } },
            { session },
        );

        if (!parentSession) await session.commitTransaction();

        console.log(
            `[Commission] ${delta >= 0 ? "+" : ""}৳${delta} for earning ${earningId} (target ৳${desired}, was ৳${previous})`,
        );

        return { earningId, staffId, delta, desired, previous };
    } catch (err) {
        if (!parentSession) await session.abortTransaction();
        console.error("[Commission] reconcile failed:", err);
        throw err;
    } finally {
        if (!parentSession) session.endSession();
    }
}

/**
 * Back-compat aliases — reconciliation is self-correcting, so "process" and
 * "reverse" are just the same call. `reverse` exists for readability at the
 * call site where an earning has just been deleted.
 */
const processEarningCommission = reconcileEarningCommission;
const reverseEarningCommission = (
    earningId: string,
    actorUserId?: string,
    parentSession?: ClientSession,
) => reconcileEarningCommission(earningId, actorUserId, parentSession);

export default {
    reconcileEarningCommission,
    processEarningCommission,
    reverseEarningCommission,
    COMMISSION_RATE,
};
