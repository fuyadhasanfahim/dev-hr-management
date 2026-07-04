import type { Request, Response, NextFunction } from 'express';
import { ReceiptService } from '../services/receipt.service.js';
import { ReceiptPuppeteerPdfService } from '../services/receipt-puppeteer-pdf.service.js';
import { logger } from '../lib/logger.js';

const createReceipt = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) return next(new Error('Unauthorized'));
        const result = await ReceiptService.createReceipt(req.body, userId);
        res.status(201).json({ success: true, message: 'Receipt created successfully', data: result });
    } catch (err) {
        next(err);
    }
};

const getAllReceipts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters: any = {};
        if (req.query.clientId) filters.clientId = req.query.clientId;
        if (req.query.quotationGroupId) filters.quotationGroupId = req.query.quotationGroupId;
        if (req.query.status) filters.status = req.query.status;
        if (req.query.search) filters.search = req.query.search;

        const options = {
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        };

        const result = await ReceiptService.getReceipts(filters, options);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

const getReceiptById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('ID is required'));
        const result = await ReceiptService.getReceiptById(id);
        if (!result) return res.status(404).json({ success: false, message: 'Receipt not found' });
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

const getPaymentSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { quotationGroupId } = req.params;
        if (!quotationGroupId) return next(new Error('quotationGroupId is required'));
        const result = await ReceiptService.getPaymentSummary(quotationGroupId);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

const sendReceipt = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('Receipt ID is required'));
        const emails =
            Array.isArray((req as any)?.body?.emails) && (req as any).body.emails.length
                ? (req as any).body.emails
                : undefined;

        logger.info({ receiptId: id }, 'receipt.send.requested');
        const result = await ReceiptService.sendReceipt(id, emails);

        res.status(200).json({
            success: true,
            message: result.emailSent
                ? 'Receipt email sent to client'
                : 'Receipt could not be emailed to any recipient',
            data: result,
        });
    } catch (err) {
        next(err);
    }
};

const downloadReceiptPdfPuppeteer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('ID is required'));
        const { buffer, filename } = await ReceiptPuppeteerPdfService.generatePdf(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (err) {
        next(err);
    }
};

const voidReceipt = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('ID is required'));
        const { reason } = req.body || {};
        const result = await ReceiptService.voidReceipt(id, reason);
        res.status(200).json({ success: true, message: 'Receipt voided successfully', data: result });
    } catch (err) {
        next(err);
    }
};

const deleteReceipt = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('ID is required'));
        await ReceiptService.deleteReceipt(id);
        return res.status(200).json({ success: true, message: 'Receipt deleted successfully' });
    } catch (err) {
        next(err);
    }
};

export default {
    createReceipt,
    getAllReceipts,
    getReceiptById,
    getPaymentSummary,
    sendReceipt,
    downloadReceiptPdfPuppeteer,
    voidReceipt,
    deleteReceipt,
};
