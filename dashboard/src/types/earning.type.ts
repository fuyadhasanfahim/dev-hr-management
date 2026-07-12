export type EarningStatus = 'partial' | 'paid' | 'void';

export interface IEarningPayment {
    receiptPaymentId: string;
    amount: number;
    paymentDate: string;
    paymentType: string;
    milestoneLabel?: string;
    method?: string;
    note?: string;
}

export interface IEarning {
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
    payments: IEarningPayment[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface EarningFilters {
    page?: number;
    limit?: number;
    clientId?: string;
    status?: EarningStatus;
    search?: string;
    filterType?: 'today' | 'week' | 'month' | 'year';
    month?: number;
    year?: number;
}

export interface EarningsResponse {
    message: string;
    data: IEarning[];
    meta: {
        total: number;
        page: number;
        totalPages: number;
    };
}

export interface EarningResponse {
    message: string;
    data: IEarning;
}

export interface EarningStats {
    totalCount: number;
    totalAmount: number;
    totalPaidAmount: number;
    partialCount: number;
    paidCount: number;
    filteredCount: number;
    filteredTotalAmount: number;
    filteredPaidAmount: number;
}

export interface EarningStatsResponse {
    message: string;
    data: EarningStats;
}

export interface YearsResponse {
    message: string;
    data: number[];
}

export const MONTHS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
] as const;
