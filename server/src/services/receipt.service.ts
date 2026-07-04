import { Types } from 'mongoose';
import ReceiptModel, { type IReceipt, type ReceiptPaymentType } from '../models/receipt.model.js';
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

/** Sum of all still-valid ("issued") receipts for a quotation group. */
async function sumPaid(quotationGroupId: string, excludeReceiptId?: string): Promise<number> {
    const match: Record<string, unknown> = { quotationGroupId, status: 'issued' };
    if (excludeReceiptId) match._id = { $ne: new Types.ObjectId(excludeReceiptId) };
    const rows = await ReceiptModel.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return rows[0]?.total || 0;
}

export interface CreateReceiptInput {
    quotationId: string;
    paymentType: ReceiptPaymentType;
    milestoneLabel?: string;
    amount: number;
    paymentDate?: string | Date;
    method?: string;
    note?: string;
}

export class ReceiptService {
    static async createReceipt(data: CreateReceiptInput, userId: string): Promise<IReceipt> {
        if (!data.quotationId) throw new AppError('quotationId is required', 400);
        if (!data.paymentType) throw new AppError('paymentType is required', 400);
        if (!data.amount || data.amount <= 0) {
            throw new AppError('amount must be greater than 0', 400);
        }

        const quotation = await QuotationModel.findById(data.quotationId).populate('clientId', 'name');
        if (!quotation) throw new AppError('Quotation not found', 404);

        const grandTotal = quotation.totals?.grandTotal || 0;
        const alreadyPaid = await sumPaid(quotation.quotationGroupId);
        const remaining = grandTotal - alreadyPaid;

        if (remaining <= 0.009) {
            throw new AppError('This quotation is already fully paid.', 409);
        }
        if (data.amount > remaining + 0.01) {
            throw new AppError(
                `Amount exceeds remaining balance (${formatAmount(remaining, quotation.currency || 'USD')}).`,
                400,
            );
        }

        const receiptNumber = await generateReceiptNumber();
        const client = quotation.clientId as unknown as { _id: Types.ObjectId; name?: string } | null;

        const receipt = new ReceiptModel({
            receiptNumber,
            quotationId: quotation._id,
            quotationGroupId: quotation.quotationGroupId,
            quotationNumber: quotation.quotationNumber,
            clientId: client?._id,
            clientName: client?.name || quotation.client?.contactName || 'Client',
            projectTitle: quotation.details?.title || 'Project',
            category: quotation.category || 'web-development',
            currency: quotation.currency || '৳',
            paymentType: data.paymentType,
            ...(data.paymentType === 'milestone' && data.milestoneLabel
                ? { milestoneLabel: data.milestoneLabel }
                : {}),
            amount: data.amount,
            paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
            ...(data.method ? { method: data.method } : {}),
            ...(data.note ? { note: data.note } : {}),
            status: 'issued',
            createdBy: new Types.ObjectId(userId),
        });

        return await receipt.save();
    }

    static async getReceipts(filters: any = {}, options: any = {}) {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
        const skip = (page - 1) * limit;

        const mongoFilters: any = {};
        if (filters.clientId) mongoFilters.clientId = filters.clientId;
        if (filters.quotationGroupId) mongoFilters.quotationGroupId = filters.quotationGroupId;
        if (filters.status) mongoFilters.status = filters.status;
        if (filters.search) {
            mongoFilters.$or = [
                { receiptNumber: { $regex: filters.search, $options: 'i' } },
                { clientName: { $regex: filters.search, $options: 'i' } },
                { projectTitle: { $regex: filters.search, $options: 'i' } },
            ];
        }

        const [items, total] = await Promise.all([
            ReceiptModel.find(mongoFilters).sort(sort).skip(skip).limit(limit).exec(),
            ReceiptModel.countDocuments(mongoFilters),
        ]);

        return { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
    }

    static async getReceiptById(id: string): Promise<IReceipt | null> {
        return ReceiptModel.findById(id);
    }

    /**
     * Powers both the "new receipt" form's live preview and the receipt detail
     * page's payment history — quotation essentials + every receipt recorded
     * against it + the resulting paid/remaining balance.
     */
    static async getPaymentSummary(quotationGroupId: string) {
        const quotation = await QuotationModel.findOne({
            quotationGroupId,
            isLatestVersion: true,
        }).populate('clientId', 'name emails');
        if (!quotation) throw new AppError('Quotation not found', 404);

        const receipts = await ReceiptModel.find({ quotationGroupId }).sort({
            paymentDate: -1,
            createdAt: -1,
        });
        const totalPaid = receipts
            .filter((r) => r.status === 'issued')
            .reduce((sum, r) => sum + r.amount, 0);
        const grandTotal = quotation.totals?.grandTotal || 0;
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
            receipts,
            totalPaid,
            remaining,
        };
    }

    static async voidReceipt(id: string, reason?: string): Promise<IReceipt> {
        const receipt = await ReceiptModel.findById(id);
        if (!receipt) throw new AppError('Receipt not found', 404);
        if (receipt.status === 'void') return receipt;

        receipt.status = 'void';
        receipt.voidReason = reason?.trim() || 'Voided by staff';
        return await receipt.save();
    }

    static async deleteReceipt(id: string): Promise<void> {
        const receipt = await ReceiptModel.findById(id);
        if (!receipt) throw new AppError('Receipt not found', 404);
        await receipt.deleteOne();
    }

    static async sendReceipt(
        id: string,
        recipientEmails?: string[],
    ): Promise<{ recipients: RecipientSendStatus[]; emailSent: boolean }> {
        const receipt = await ReceiptModel.findById(id);
        if (!receipt) throw new AppError('Receipt not found', 404);
        if (receipt.status === 'void') {
            throw new AppError('Cannot send a voided receipt', 400);
        }

        const client = await ClientModel.findById(receipt.clientId).lean();
        const fromRequest = (recipientEmails ?? [])
            .map((e) => String(e || '').trim())
            .filter(Boolean);
        const fromClient = (client?.emails ?? []).map((e) => String(e || '').trim()).filter(Boolean);
        const toList = Array.from(new Set((fromRequest.length ? fromRequest : fromClient).filter(Boolean)));

        if (toList.length === 0) {
            throw new AppError('Client has no emails on record', 400);
        }

        const { buffer, filename } = await ReceiptPuppeteerPdfService.generatePdf(id);
        const summary = await ReceiptService.getPaymentSummary(receipt.quotationGroupId);

        const recipients: RecipientSendStatus[] = [];
        await Promise.all(
            toList.map(async (to) => {
                try {
                    await emailService.sendReceiptEmail({
                        to,
                        clientName: receipt.clientName,
                        receiptNumber: receipt.receiptNumber,
                        projectTitle: receipt.projectTitle,
                        amountFormatted: formatAmount(receipt.amount, receipt.currency || 'USD'),
                        remainingFormatted: formatAmount(summary.remaining, receipt.currency || 'USD'),
                        paymentDateFormatted: receipt.paymentDate
                            ? new Date(receipt.paymentDate).toLocaleDateString('en-GB')
                            : undefined,
                        ...(receipt.milestoneLabel ? { milestoneLabel: receipt.milestoneLabel } : {}),
                        attachment: {
                            filename,
                            content: buffer,
                            contentType: 'application/pdf',
                        },
                    });
                    recipients.push({ email: to, status: 'sent' });
                } catch (e: any) {
                    recipients.push({ email: to, status: 'failed', error: e?.message || String(e) });
                }
            }),
        );

        const emailSent = recipients.some((r) => r.status === 'sent');
        logger.info(
            { receiptId: receipt._id.toString(), emailSent, recipients },
            'receipt.send_result',
        );

        return { recipients, emailSent };
    }
}
