import type { Request, Response, NextFunction } from 'express';
import { QuotationService } from '../services/quotation.service.js';
import { logger } from '../lib/logger.js';

// ─── Staff / Admin Handlers ───────────────────────────────────────────────────

const createQuotation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) return next(new Error('Unauthorized'));
        const result = await QuotationService.createQuotation(req.body, userId);
        res.status(201).json({ success: true, message: 'Quotation created successfully', data: result });
    } catch (err) {
        next(err);
    }
};

const updateQuotation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) return next(new Error('Unauthorized'));
        const result = await QuotationService.updateQuotation(req.params.id, req.body, userId);
        res.status(200).json({ success: true, message: 'Quotation updated successfully', data: result });
    } catch (err) {
        next(err);
    }
};

const sendQuotation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) return next(new Error('Unauthorized'));
        const emails =
            Array.isArray((req as any)?.body?.emails) && (req as any).body.emails.length
                ? (req as any).body.emails
                : undefined;
        logger.info({ quotationId: req.params.id }, 'quotation.send.requested');
        const result = await QuotationService.sendQuotation(req.params.id, userId, emails);
        const q = result.quotation;
        logger.info(
            {
                quotationId: q._id.toString(),
                quotationGroupId: q.quotationGroupId,
                quotationVersion: q.version,
                tokenExpiresAt: q.tokenExpiresAt,
                emailSent: result.emailSent,
                emailedTo: result.emailedTo,
                failedCount: result.recipients.filter((r) => r.status === 'failed').length,
            },
            'quotation.send.completed',
        );
        res.status(200).json({
            success: true,
            message: result.emailSent
                ? 'Quotation email sent to client'
                : 'Quotation link generated (email not sent)',
            data: {
                quotationId: q._id,
                quotationNumber: q.quotationNumber,
                secureToken: q.secureToken,
                tokenExpiresAt: q.tokenExpiresAt,
                clientLink: result.clientLink,
                emailSent: result.emailSent,
                emailedTo: result.emailedTo,
                emailError: result.emailError,
                recipients: result.recipients,
            },
        });
    } catch (err) {
        next(err);
    }
};

const createNewVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) return next(new Error('Unauthorized'));
        const idempotencyKey = (req.header('x-idempotency-key') || req.header('idempotency-key') || undefined) as
            | string
            | undefined;
        const result = await QuotationService.createNewVersion(
            req.params.groupId,
            req.body,
            userId,
            idempotencyKey,
        );
        res.status(201).json({
            success: true,
            message: `New version v${result.version} created successfully`,
            data: result,
        });
    } catch (err) {
        next(err);
    }
};

const getAllQuotations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters: any = {};
        if (req.query.status) filters.status = req.query.status;
        if (req.query.clientId) filters.clientId = req.query.clientId;
        if (req.query.search) filters.search = req.query.search;
        if (req.query.isLatestVersion !== undefined) {
            filters.isLatestVersion = req.query.isLatestVersion === 'true';
        }

        const options = {
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        };

        const result = await QuotationService.getQuotations(filters, options);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

const getQuotationById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await QuotationService.getQuotationById(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Quotation not found' });
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

const getGroupVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await QuotationService.getGroupVersions(req.params.groupId);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

const deleteQuotation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await QuotationService.deleteQuotation(req.params.id);
        res.status(200).json({ success: true, message: 'Quotation deleted successfully' });
    } catch (err) {
        next(err);
    }
};

// ─── Public / Client Handlers (token-authenticated) ──────────────────────────

/**
 * Client accesses quotation via secure link.
 * No auth middleware — the token IS the credential.
 */
const viewQuotationByToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.info({ token: req.params.token ? 'present' : 'missing' }, 'quotation.view_by_token.requested');
        const result = await QuotationService.getQuotationByToken(req.params.token);
        logger.info(
            { quotationId: result._id.toString(), quotationGroupId: result.quotationGroupId, status: result.status },
            'quotation.view_by_token.completed',
        );
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
};

/**
 * Client accepts the quotation.
 * Triggers payment tracker initialization via event bus.
 */
const acceptQuotation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.info({ token: req.params.token ? 'present' : 'missing' }, 'quotation.accept.requested');
        const result = await QuotationService.acceptQuotation(req.params.token);
        logger.info(
            { quotationId: result._id.toString(), quotationGroupId: result.quotationGroupId, status: result.status },
            'quotation.accept.completed',
        );
        res.status(200).json({
            success: true,
            message: 'Quotation accepted. Proceed to payment.',
            data: {
                quotationGroupId: result.quotationGroupId,
                status: result.status,
            },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Client requests changes.
 * Staff must create a new version in response.
 */
const requestChanges = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { reason } = req.body;
        if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'A reason for the change request is required (minimum 10 characters)',
            });
        }
        logger.info({ token: req.params.token ? 'present' : 'missing' }, 'quotation.change_request.requested');
        const result = await QuotationService.requestChanges(req.params.token, reason.trim());
        logger.info(
            { quotationId: result._id.toString(), quotationGroupId: result.quotationGroupId, status: result.status },
            'quotation.change_request.completed',
        );
        res.status(200).json({
            success: true,
            message: 'Change request submitted. The team will review and issue a new version.',
            data: { status: result.status, changeRequestReason: result.changeRequestReason },
        });
    } catch (err) {
        next(err);
    }
};

export default {
    createQuotation,
    updateQuotation,
    sendQuotation,
    createNewVersion,
    getAllQuotations,
    getQuotationById,
    getGroupVersions,
    deleteQuotation,
    // Public
    viewQuotationByToken,
    acceptQuotation,
    requestChanges,
};
