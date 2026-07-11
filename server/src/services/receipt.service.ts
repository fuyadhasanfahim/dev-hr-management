import { Types } from 'mongoose';
import type { ClientSession } from 'mongoose';
import ReceiptModel, { type IReceipt, type PaymentStatus, type ReceiptPaymentType } from '../models/receipt.model.js';
import ReceiptPaymentModel, { type IReceiptPayment } from '../models/receipt-payment.model.js';
import QuotationModel from '../models/quotation.model.js';
import ClientModel from '../models/client.model.js';
import { InvoiceCounter } from '../models/invoice-counter.model.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';
import emailService from './email.service.js';
import { ReceiptPuppeteerPdfService } from './receipt-puppeteer-pdf.service.js';

export type RecipientSendStatus = {
    email: string;
    status: 'sent' | 'failed';
    error?: string;
};

function formatAmount(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
    } catch {
        return `${amount} ${currency}`;
    }
}

async function generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await InvoiceCounter.findByIdAndUpdate(
        { _id: `receipt_${year}` },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
    );
    return `RCPT-${year}-${counter.seq.toString().padStart(4, '0')}`;
}

/**
 * Recalculate and persist `totalPaid` and `paymentStatus` on a Receipt
 * from its ReceiptPayment children. Call inside a session for atomicity.
 */
async function recalculateReceiptTotals(
    receipt: IReceipt,
    grandTotal: number,
    session?: ClientSession,
): Promise<void> {
    const payments = await ReceiptPaymentModel.find(
        { receiptId: receipt._id, status: 'recorded' },
        { amount: 1 },
        session ? { session } : {},
    );

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    let paymentStatus: PaymentStatus = 'pending';
    if (totalPaid >= grandTotal && grandTotal > 0) {
        paymentStatus = 'paid';
    } else if (totalPaid > 0) {
        paymentStatus = 'partial';
    }

    receipt.totalPaid = totalPaid;
    receipt.paymentStatus = paymentStatus;

    if (session) {
        await receipt.save({ session });
    } else {
        await receipt.save();
    }
}

export interface AddPaymentInput {
    paymentType: ReceiptPaymentType;
    milestoneLabel?: string;
    amount: number;
    paymentDate?: string | Date;
    method?: string;
    note?: string;
}

export class ReceiptService {
    /**
     * Called automatically when a quotation is created.
     * Creates one Receipt ledger document (zero-paid baseline).
     */
    static async createZeroPaymentReceipt(quotation: any, userId: string): Promise<IReceipt> {
        // Prevent duplicate — one receipt per quotation
        const existing = await ReceiptModel.findOne({ quotationGroupId: quotation.quotationGroupId });
        if (existing) {
            logger.warn({ quotationGroupId: quotation.quotationGroupId }, 'receipt.zero_payment.already_exists');
            return existing;
        }

        const receiptNumber = await generateReceiptNumber();
        const clientId = quotation.clientId;

        let clientName = quotation.client?.contactName || 'Client';
        if (clientId) {
            const clientDoc = await ClientModel.findById(clientId?._id || clientId);
            if (clientDoc) clientName = clientDoc.name || clientName;
        }

        const receipt = new ReceiptModel({
            receiptNumber,
            quotationId: quotation._id,
            quotationGroupId: quotation.quotationGroupId,
            quotationNumber: quotation.quotationNumber,
            clientId: clientId?._id || clientId,
            clientName,
            projectTitle: quotation.details?.title || 'Project',
            category: quotation.category || 'web-development',
            currency: quotation.currency || '৳',
            totalPaid: 0,
            paymentStatus: 'pending',
            paymentHistory: [],
            status: 'issued',
            createdBy: new Types.ObjectId(userId),
        });

        return await receipt.save();
    }

    /**
     * Add a payment transaction to an existing Receipt ledger.
     * Validates against quotation grand total before saving.
     */
    static async addPayment(
        receiptId: string,
        data: AddPaymentInput,
        userId: string,
    ): Promise<{ receipt: IReceipt; payment: IReceiptPayment }> {
        if (!data.amount || data.amount <= 0) throw new AppError('amount must be greater than 0', 400);
        if (!data.paymentType) throw new AppError('paymentType is required', 400);

        const receipt = await ReceiptModel.findById(receiptId);
        if (!receipt) throw new AppError('Receipt not found', 404);
        if (receipt.status === 'void') throw new AppError('Cannot add payment to a voided receipt', 400);

        // Fetch quotation grand total for balance validation
        const quotation = await QuotationModel.findById(receipt.quotationId);
        if (!quotation) throw new AppError('Linked quotation not found', 404);

        const grandTotal = quotation.totals?.grandTotal || 0;
        const remaining = Math.max(0, grandTotal - receipt.totalPaid);

        if (remaining <= 0.009) throw new AppError('This quotation is already fully paid.', 409);
        if (data.amount > remaining + 0.01) {
            throw new AppError(
                `Amount exceeds remaining balance (${formatAmount(remaining, receipt.currency || '৳')}).`,
                400,
            );
        }

        // Create the payment entry
        const payment = new ReceiptPaymentModel({
            receiptId: receipt._id,
            paymentType: data.paymentType,
            ...(data.paymentType === 'milestone' && data.milestoneLabel
                ? { milestoneLabel: data.milestoneLabel }
                : {}),
            amount: data.amount,
            paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
            ...(data.method ? { method: data.method } : {}),
            ...(data.note ? { note: data.note } : {}),
            status: 'recorded',
            createdBy: new Types.ObjectId(userId),
        });

        await payment.save();

        // Push to history and recalculate totals
        receipt.paymentHistory.push(payment._id as Types.ObjectId);
        await recalculateReceiptTotals(receipt, grandTotal);

        logger.info(
            { receiptId: receipt._id.toString(), paymentId: payment._id.toString(), amount: data.amount },
            'receipt.payment.added',
        );

        return { receipt, payment };
    }

    /**
     * Void a single payment entry and recalculate Receipt totals.
     */
    static async voidPayment(
        receiptId: string,
        paymentId: string,
        reason?: string,
    ): Promise<{ receipt: IReceipt; payment: IReceiptPayment }> {
        const receipt = await ReceiptModel.findById(receiptId);
        if (!receipt) throw new AppError('Receipt not found', 404);
        if (receipt.status === 'void') throw new AppError('Receipt is already voided', 400);

        const payment = await ReceiptPaymentModel.findOne({ _id: paymentId, receiptId: receipt._id });
        if (!payment) throw new AppError('Payment entry not found', 404);
        if (payment.status === 'void') throw new AppError('Payment is already voided', 400);

        payment.status = 'void';
        payment.voidReason = reason?.trim() || 'Voided by staff';
        await payment.save();

        const quotation = await QuotationModel.findById(receipt.quotationId);
        const grandTotal = quotation?.totals?.grandTotal || 0;
        await recalculateReceiptTotals(receipt, grandTotal);

        logger.info(
            { receiptId: receipt._id.toString(), paymentId, amount: payment.amount },
            'receipt.payment.voided',
        );

        return { receipt, payment };
    }

    static async getReceipts(filters: any = {}, options: any = {}) {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
        const skip = (page - 1) * limit;

        const mongoFilters: any = {};
        if (filters.clientId) mongoFilters.clientId = filters.clientId;
        if (filters.quotationGroupId) mongoFilters.quotationGroupId = filters.quotationGroupId;
        if (filters.status) mongoFilters.status = filters.status;
        if (filters.paymentStatus) mongoFilters.paymentStatus = filters.paymentStatus;
        if (filters.search) {
            mongoFilters.$or = [
                { receiptNumber: { $regex: filters.search, $options: 'i' } },
                { clientName: { $regex: filters.search, $options: 'i' } },
                { projectTitle: { $regex: filters.search, $options: 'i' } },
            ];
        }

        const [items, total] = await Promise.all([
            ReceiptModel.find(mongoFilters)
                .populate('quotationId', 'totals')
                .populate({
                    path: 'paymentHistory',
                    options: { sort: { paymentDate: -1 } },
                })
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            ReceiptModel.countDocuments(mongoFilters),
        ]);

        return { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
    }

    static async getReceiptById(id: string) {
        const receipt = await ReceiptModel.findById(id)
            .populate('quotationId', 'totals quotationNumber quotationGroupId details paymentMilestones')
            .populate({
                path: 'paymentHistory',
                options: { sort: { paymentDate: -1 } },
            })
            .lean();

        if (!receipt) throw new AppError('Receipt not found', 404);
        return receipt;
    }

    /**
     * Returns the quotation snapshot + full payment history for the summary panel.
     */
    static async getPaymentSummary(quotationGroupId: string) {
        const quotation = await QuotationModel.findOne({
            quotationGroupId,
            isLatestVersion: true,
        }).populate('clientId', 'name emails');
        if (!quotation) throw new AppError('Quotation not found', 404);

        const receipt = await ReceiptModel.findOne({ quotationGroupId })
            .populate({
                path: 'paymentHistory',
                options: { sort: { paymentDate: -1 } },
            })
            .lean();

        const grandTotal = quotation.totals?.grandTotal || 0;
        const totalPaid = receipt?.totalPaid ?? 0;
        const remaining = Math.max(0, grandTotal - totalPaid);

        return {
            quotation: {
                _id: quotation._id,
                quotationGroupId: quotation.quotationGroupId,
                quotationNumber: quotation.quotationNumber,
                title: quotation.details?.title,
                category: quotation.category,
                currency: quotation.currency,
                grandTotal,
                paymentMilestones: quotation.paymentMilestones || [],
                clientId: quotation.clientId,
            },
            receipt: receipt ?? null,
            payments: (receipt?.paymentHistory ?? []) as unknown as IReceiptPayment[],
            totalPaid,
            remaining,
        };
    }

    static async voidReceipt(id: string, reason?: string): Promise<IReceipt> {
        const receipt = await ReceiptModel.findById(id);
        if (!receipt) throw new AppError('Receipt not found', 404);
        if (receipt.status === 'void') return receipt;

        receipt.status = 'void';
        receipt.paymentStatus = 'void';
        receipt.voidReason = reason?.trim() || 'Voided by staff';
        return await receipt.save();
    }

    static async deleteReceipt(id: string): Promise<void> {
        const receipt = await ReceiptModel.findById(id);
        if (!receipt) throw new AppError('Receipt not found', 404);
        // Also delete all child payment entries
        await ReceiptPaymentModel.deleteMany({ receiptId: receipt._id });
        await receipt.deleteOne();
    }

    static async sendReceipt(
        id: string,
        recipientEmails?: string[],
    ): Promise<{ recipients: RecipientSendStatus[]; emailSent: boolean }> {
        const receipt = await ReceiptModel.findById(id);
        if (!receipt) throw new AppError('Receipt not found', 404);
        if (receipt.status === 'void') throw new AppError('Cannot send a voided receipt', 400);

        const client = await ClientModel.findById(receipt.clientId).lean();
        const fromRequest = (recipientEmails ?? []).map((e) => String(e || '').trim()).filter(Boolean);
        const fromClient = (client?.emails ?? []).map((e) => String(e || '').trim()).filter(Boolean);
        const toList = Array.from(new Set((fromRequest.length ? fromRequest : fromClient).filter(Boolean)));

        if (toList.length === 0) throw new AppError('Client has no emails on record', 400);

        const summary = await ReceiptService.getPaymentSummary(receipt.quotationGroupId);
        const { buffer, filename } = await ReceiptPuppeteerPdfService.generatePdf(id);

        const recipients: RecipientSendStatus[] = [];
        await Promise.all(
            toList.map(async (to) => {
                try {
                    await emailService.sendReceiptEmail({
                        to,
                        clientName: receipt.clientName,
                        receiptNumber: receipt.receiptNumber,
                        projectTitle: receipt.projectTitle,
                        amountFormatted: formatAmount(receipt.totalPaid, receipt.currency || '৳'),
                        remainingFormatted: formatAmount(summary.remaining, receipt.currency || '৳'),
                        attachment: { filename, content: buffer, contentType: 'application/pdf' },
                    });
                    recipients.push({ email: to, status: 'sent' });
                } catch (e: any) {
                    recipients.push({ email: to, status: 'failed', error: e?.message || String(e) });
                }
            }),
        );

        const emailSent = recipients.some((r) => r.status === 'sent');
        logger.info({ receiptId: receipt._id.toString(), emailSent, recipients }, 'receipt.send_result');
        return { recipients, emailSent };
    }
}
