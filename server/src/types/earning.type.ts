import { Document, Types } from 'mongoose';

export type EarningStatus = 'partial' | 'paid' | 'void';

export interface IEarningPayment {
    receiptPaymentId: Types.ObjectId;
    amount: number;
    paymentDate: Date;
    paymentType: string;
    milestoneLabel?: string;
    method?: string;
    note?: string;
}

/**
 * An Earning mirrors a Receipt 1:1 — it only exists once the receipt has at
 * least one recorded payment, and is fully kept in sync from the receipt's
 * payment history by `EarningService.syncEarningFromReceipt`.
 */
export interface IEarning extends Document {
    clientId: Types.ObjectId;
    receiptId: Types.ObjectId;
    quotationGroupId: string;
    quotationNumber: string;
    orderTitle: string;
    currency: string;

    totalAmount: number;   // grand total, from Quotation.totals.grandTotal
    paidAmount: number;    // mirrors receipt.totalPaid
    amountInBDT: number;   // = paidAmount (no currency conversion)

    status: EarningStatus;
    month: number;         // derived from the latest payment's date
    year: number;

    payments: IEarningPayment[];

    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface IEarningPopulated {
    _id: string;
    clientId: {
        _id: string;
        clientId: string;
        name: string;
        emails: string[];
    };
    receiptId: {
        _id: string;
        receiptNumber: string;
    };
    quotationGroupId: string;
    quotationNumber: string;
    orderTitle: string;
    currency: string;
    totalAmount: number;
    paidAmount: number;
    amountInBDT: number;
    status: EarningStatus;
    month: number;
    year: number;
    payments: Array<{
        receiptPaymentId: string;
        amount: number;
        paymentDate: string;
        paymentType: string;
        milestoneLabel?: string;
        method?: string;
        note?: string;
    }>;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface EarningQueryParams {
    page?: number;
    limit?: number;
    clientId?: string;
    status?: EarningStatus;
    search?: string;
    filterType?: 'today' | 'week' | 'month' | 'year';
    month?: number;
    year?: number;
}

export interface EarningStatsResult {
    totalCount: number;
    totalAmount: number;
    totalPaidAmount: number;
    partialCount: number;
    paidCount: number;
    filteredCount: number;
    filteredTotalAmount: number;
    filteredPaidAmount: number;
}
