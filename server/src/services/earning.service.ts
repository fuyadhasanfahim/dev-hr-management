import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { Types } from 'mongoose';
import EarningModel from '../models/earning.model.js';
import ReceiptModel from '../models/receipt.model.js';
import ReceiptPaymentModel from '../models/receipt-payment.model.js';
import QuotationModel from '../models/quotation.model.js';
import { logger } from '../lib/logger.js';
import type {
    IEarning,
    IEarningPopulated,
    EarningQueryParams,
    EarningStatsResult,
} from '../types/earning.type.js';

/**
 * The only way an Earning is ever created, updated, or removed.
 * Rebuilds the Earning for this receipt from its current recorded payments —
 * an Earning only exists once a receipt has at least one recorded payment,
 * and disappears again if all of its payments are voided.
 */
async function syncEarningFromReceipt(
    receiptId: string,
    userId?: string,
): Promise<IEarning | null> {
    const receipt = await ReceiptModel.findById(receiptId);
    if (!receipt) return null;

    const payments = await ReceiptPaymentModel.find({
        receiptId: receipt._id,
        status: 'recorded',
    }).sort({ paymentDate: 1 });

    if (payments.length === 0) {
        await EarningModel.deleteOne({ receiptId: receipt._id });
        return null;
    }

    const quotation = await QuotationModel.findById(receipt.quotationId);
    const totalAmount = quotation?.totals?.grandTotal || 0;
    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const status = paidAmount >= totalAmount && totalAmount > 0 ? 'paid' : 'partial';
    const latestPaymentDate = payments[payments.length - 1]!.paymentDate;

    const paymentEntries = payments.map((p) => ({
        receiptPaymentId: p._id,
        amount: p.amount,
        paymentDate: p.paymentDate,
        paymentType: p.paymentType,
        ...(p.milestoneLabel ? { milestoneLabel: p.milestoneLabel } : {}),
        ...(p.method ? { method: p.method } : {}),
        ...(p.note ? { note: p.note } : {}),
    }));

    const earning = await EarningModel.findOneAndUpdate(
        { receiptId: receipt._id },
        {
            $set: {
                clientId: receipt.clientId,
                quotationGroupId: receipt.quotationGroupId,
                quotationNumber: receipt.quotationNumber,
                orderTitle: receipt.projectTitle,
                currency: receipt.currency || '৳',
                totalAmount,
                paidAmount,
                amountInBDT: paidAmount,
                status,
                month: latestPaymentDate.getMonth() + 1,
                year: latestPaymentDate.getFullYear(),
                payments: paymentEntries,
            },
            $setOnInsert: {
                receiptId: receipt._id,
                createdBy: new Types.ObjectId(userId || receipt.createdBy.toString()),
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    logger.info(
        { receiptId: receipt._id.toString(), earningId: earning._id.toString(), paidAmount, status },
        'earning.synced_from_receipt',
    );

    return earning;
}

function buildEarningFilter(params: EarningQueryParams): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (params.clientId) filter.clientId = new Types.ObjectId(params.clientId);
    if (params.status) filter.status = params.status;
    if (params.search) {
        const re = new RegExp(params.search, 'i');
        filter.$or = [{ orderTitle: re }, { quotationNumber: re }];
    }

    const now = new Date();
    switch (params.filterType) {
        case 'today': {
            filter.payments = {
                $elemMatch: { paymentDate: { $gte: startOfDay(now), $lte: endOfDay(now) } },
            };
            break;
        }
        case 'week': {
            filter.payments = {
                $elemMatch: {
                    paymentDate: {
                        $gte: startOfWeek(now, { weekStartsOn: 1 }),
                        $lte: endOfWeek(now, { weekStartsOn: 1 }),
                    },
                },
            };
            break;
        }
        case 'month':
            filter.month = params.month || now.getMonth() + 1;
            filter.year = params.year || now.getFullYear();
            break;
        case 'year':
            filter.year = params.year || now.getFullYear();
            break;
        default:
            if (params.month) filter.month = params.month;
            if (params.year) filter.year = params.year;
    }

    return filter;
}

async function getAllEarnings(params: EarningQueryParams): Promise<{
    earnings: IEarningPopulated[];
    total: number;
    page: number;
    totalPages: number;
}> {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;
    const filter = buildEarningFilter(params);

    const [earnings, total] = await Promise.all([
        EarningModel.find(filter)
            .populate('clientId', 'clientId name emails')
            .populate('receiptId', 'receiptNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        EarningModel.countDocuments(filter),
    ]);

    return {
        earnings: earnings as unknown as IEarningPopulated[],
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}

async function getEarningByIdFromDB(id: string): Promise<IEarningPopulated | null> {
    return EarningModel.findById(id)
        .populate('clientId', 'clientId name emails')
        .populate('receiptId', 'receiptNumber')
        .lean() as Promise<IEarningPopulated | null>;
}

async function getEarningStatsWithFilter(
    params: EarningQueryParams,
): Promise<EarningStatsResult> {
    const clientMatch: Record<string, unknown> = {};
    if (params.clientId) clientMatch.clientId = new Types.ObjectId(params.clientId);

    const [totalAgg, filteredAgg] = await Promise.all([
        EarningModel.aggregate([
            { $match: clientMatch },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' },
                    totalPaidAmount: { $sum: '$paidAmount' },
                    partialCount: { $sum: { $cond: [{ $eq: ['$status', 'partial'] }, 1, 0] } },
                    paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
                },
            },
        ]),
        EarningModel.aggregate([
            { $match: buildEarningFilter(params) },
            {
                $group: {
                    _id: null,
                    filteredCount: { $sum: 1 },
                    filteredTotalAmount: { $sum: '$totalAmount' },
                    filteredPaidAmount: { $sum: '$paidAmount' },
                },
            },
        ]),
    ]);

    const t = totalAgg[0] || {};
    const f = filteredAgg[0] || {};

    return {
        totalCount: t.totalCount || 0,
        totalAmount: t.totalAmount || 0,
        totalPaidAmount: t.totalPaidAmount || 0,
        partialCount: t.partialCount || 0,
        paidCount: t.paidCount || 0,
        filteredCount: f.filteredCount || 0,
        filteredTotalAmount: f.filteredTotalAmount || 0,
        filteredPaidAmount: f.filteredPaidAmount || 0,
    };
}

async function getEarningYearsFromDB(): Promise<number[]> {
    const result = await EarningModel.aggregate([
        { $group: { _id: '$year' } },
        { $sort: { _id: -1 } },
    ]);
    return result.map((r) => r._id).filter((y) => y !== null);
}

export default {
    syncEarningFromReceipt,
    getAllEarnings,
    getEarningByIdFromDB,
    getEarningStatsWithFilter,
    getEarningYearsFromDB,
};
