import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import QuotationModel from '../models/quotation.model.js';
import { InvoiceCounter } from '../models/invoice-counter.model.js';
import type { IQuotation } from '../types/quotation.type.js';
import type { QuotationStatus } from '../types/quotation.type.js';
import { AppError } from '../utils/AppError.js';
import { OutboxService } from './outbox.service.js';
import { quotationPaymentEventQueue } from './queue.service.js';
import { getCorrelationId } from '../lib/requestContext.js';
import { logger } from '../lib/logger.js';
import ClientModel from '../models/client.model.js';
import envConfig from '../config/env.config.js';
import emailService from './email.service.js';

type SendQuotationResult = {
    quotation: IQuotation;
    clientLink: string;
    emailSent: boolean;
    emailedTo?: string[];
    emailError?: string;
};

const QUOTATION_TOKEN_SECRET = process.env.QUOTATION_TOKEN_SECRET;
const TOKEN_EXPIRY_DAYS = 30;

if (!QUOTATION_TOKEN_SECRET) {
    throw new Error('QUOTATION_TOKEN_SECRET env variable is required');
}

// ─── Calculation Helper ───────────────────────────────────────────────────────

function calculateTotals(data: Partial<IQuotation>) {
    const basePrice = data.pricing?.basePrice || 0;
    const additionalServicesTotal = data.additionalServices?.reduce((acc, s) => acc + (s.price || 0), 0) || 0;
    const discountRate = data.pricing?.discount || 0;
    const taxRate = data.pricing?.taxRate || 0;

    const subtotalBeforeDiscount = basePrice + additionalServicesTotal;
    const discountAmount = (subtotalBeforeDiscount * discountRate) / 100;
    const subtotal = subtotalBeforeDiscount - discountAmount;
    const taxAmount = (subtotal * taxRate) / 100;
    const grandTotal = subtotal + taxAmount;

    return {
        subtotal,
        taxAmount,
        grandTotal,
    };
}

// ─── Token Helpers ────────────────────────────────────────────────────────────

interface QuotationTokenPayload {
    quotationGroupId: string;
    quotationId: string;
    version: number;
}

function signQuotationToken(payload: QuotationTokenPayload): string {
    return jwt.sign(payload, QUOTATION_TOKEN_SECRET!, {
        expiresIn: `${TOKEN_EXPIRY_DAYS}d`,
    });
}

function verifyQuotationToken(token: string): QuotationTokenPayload {
    try {
        return jwt.verify(token, QUOTATION_TOKEN_SECRET!) as QuotationTokenPayload;
    } catch {
        throw new AppError('Invalid or expired quotation link', 410);
    }
}

// ─── State machine (simple but explicit) ──────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<QuotationStatus, ReadonlySet<QuotationStatus>> = {
    draft: new Set(['sent', 'superseded', 'expired']),
    sent: new Set(['viewed', 'accepted', 'change_requested', 'rejected', 'expired', 'superseded']),
    viewed: new Set(['accepted', 'change_requested', 'rejected', 'expired', 'superseded']),
    change_requested: new Set(['superseded', 'expired']),
    accepted: new Set(['superseded']),
    rejected: new Set(['superseded']),
    expired: new Set(['superseded']),
    superseded: new Set([]),
};

function assertTransition(from: QuotationStatus, to: QuotationStatus) {
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed?.has(to)) {
        throw new AppError(`Invalid quotation transition: ${from} → ${to}`, 409);
    }
}

function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return String(value);
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

// ─── Quotation Number Generator ───────────────────────────────────────────────

async function generateQuotationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await InvoiceCounter.findByIdAndUpdate(
        { _id: `quotation_${year}` },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
    );
    return `QTN-${year}-${counter.seq.toString().padStart(4, '0')}`;
}

// ─── QuotationService ─────────────────────────────────────────────────────────

export class QuotationService {

    static async createQuotation(
        data: Partial<IQuotation>,
        userId: string,
    ): Promise<IQuotation> {
        const quotationNumber = await generateQuotationNumber();
        const quotationGroupId = crypto.randomUUID();

        // Server-side calculation of totals for integrity
        const totals = calculateTotals(data);

        const quotation = new QuotationModel({
            ...data,
            totals,
            quotationNumber,
            quotationGroupId,
            version: 1,
            isLatestVersion: true,
            status: 'draft',
            createdBy: new Types.ObjectId(userId),
        });

        return await quotation.save();
    }

    static async updateQuotation(
        id: string,
        data: Partial<IQuotation>,
        _userId?: string,
    ): Promise<IQuotation> {
        const quotation = await QuotationModel.findById(id);
        if (!quotation) throw new AppError('Quotation not found', 404);
        if (quotation.status !== 'draft') {
            throw new AppError('Only draft quotations can be updated directly.', 409);
        }

        const totals = calculateTotals({ ...quotation.toObject(), ...data });
        
        const { quotationGroupId: _g, version: _v, isLatestVersion: _l, ...safeData } = data as any;

        Object.assign(quotation, { ...safeData, totals });
        return await quotation.save();
    }

    static async sendQuotation(id: string, _userId: string): Promise<SendQuotationResult> {
        const quotation = await QuotationModel.findById(id);
        if (!quotation) throw new AppError('Quotation not found', 404);

        // Resend semantics:
        // - If already sent/viewed, keep status as-is, reuse token if still valid (otherwise re-issue).
        // - Always attempt to send email when this endpoint is called.
        if (quotation.status !== 'sent' && quotation.status !== 'viewed') {
            assertTransition(quotation.status, 'sent');
        }

        const hasValidToken =
            Boolean(quotation.secureToken) &&
            (!quotation.tokenExpiresAt || quotation.tokenExpiresAt >= new Date());

        const tokenExpiresAt = hasValidToken
            ? quotation.tokenExpiresAt
            : (() => {
                  const d = new Date();
                  d.setDate(d.getDate() + TOKEN_EXPIRY_DAYS);
                  return d;
              })();

        // Only move to `sent` when transitioning from draft; otherwise preserve viewed state.
        if (quotation.status === 'draft') {
            quotation.status = 'sent';
        }
        if (!hasValidToken) {
            quotation.secureToken = signQuotationToken({
                quotationGroupId: quotation.quotationGroupId,
                quotationId: quotation._id.toString(),
                version: quotation.version,
            });
            quotation.tokenExpiresAt = tokenExpiresAt;
        }

        const saved = await quotation.save();

        const clientLink = `${envConfig.payment_client_url}/quotation/${saved.secureToken}`;

        let emailSent = false;
        let emailedTo: string[] | undefined;
        let emailError: string | undefined;

        try {
            const client = await ClientModel.findById(saved.clientId).lean();
            const toList = (client?.emails ?? []).filter(Boolean);

            if (toList.length === 0) {
                emailError = 'Client has no emails on record';
            } else {
                // Send to the first email; the UI/link can be shared further if needed.
                const to = toList[0]!;
                await emailService.sendQuotationEmail({
                    to,
                    clientName: saved.client?.contactName || client?.name || 'Client',
                    quotationTitle: saved.details?.title || 'Quotation',
                    quotationNumber: saved.quotationNumber,
                    clientLink,
                    validUntil: saved.details?.validUntil
                        ? new Date(saved.details.validUntil).toLocaleDateString('en-GB')
                        : undefined,
                });
                emailSent = true;
                emailedTo = [to];
            }
        } catch (err: any) {
            emailError = err?.message || String(err);
        }

        logger.info(
            {
                quotationId: saved._id.toString(),
                quotationGroupId: saved.quotationGroupId,
                quotationVersion: saved.version,
                status: saved.status,
                tokenExpiresAt: saved.tokenExpiresAt,
                correlationId: getCorrelationId(),
                emailSent,
                emailedTo,
                emailError,
            },
            'quotation.send_result',
        );

        return {
            quotation: saved,
            clientLink,
            emailSent,
            ...(emailedTo ? { emailedTo } : {}),
            ...(emailError ? { emailError } : {}),
        };
    }

    static async createNewVersion(
        quotationGroupId: string,
        data: Partial<IQuotation>,
        userId: string,
        idempotencyKey?: string,
    ): Promise<IQuotation> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Idempotency: if the same request key already created a version, return it.
            const effectiveKey =
                (idempotencyKey && String(idempotencyKey).trim()) ||
                crypto
                    .createHash('sha256')
                    .update(`${quotationGroupId}::${userId}::${stableStringify(data)}`)
                    .digest('hex');

            const existingByKey = await QuotationModel.findOne({
                quotationGroupId,
                versionCreationKey: effectiveKey,
            }).session(session);
            if (existingByKey) return existingByKey;

            const currentLatest = await QuotationModel.findOne({ quotationGroupId, isLatestVersion: true }).session(session);
            if (!currentLatest) throw new AppError('No active quotation found', 404);

            const superseded = await QuotationModel.findOneAndUpdate(
                { _id: currentLatest._id, __v: currentLatest.__v, isLatestVersion: true },
                { $set: { isLatestVersion: false, status: 'superseded' } },
                { new: true, session },
            );

            if (!superseded) throw new AppError('Quotation modified concurrently', 409);

            await QuotationModel.updateMany(
                { quotationGroupId, _id: { $ne: superseded._id }, isLatestVersion: true },
                { $set: { isLatestVersion: false, status: 'superseded' } },
                { session },
            );

            const { _id: _, __v: __, secureToken: ___, tokenExpiresAt: ____, orderId: _____, ...baseData } = currentLatest.toObject();
            const quotationNumber = await generateQuotationNumber();
            
            // Recalculate totals for the new version
            const totals = calculateTotals({ ...baseData, ...data });

            const createdDocs = await QuotationModel.create(
                [
                    {
                        ...baseData,
                        ...data,
                        totals,
                        _id: new Types.ObjectId(),
                        quotationNumber,
                        quotationGroupId,
                        version: currentLatest.version + 1,
                        isLatestVersion: true,
                        status: 'draft',
                        createdBy: new Types.ObjectId(userId),
                        versionCreationKey: effectiveKey,
                        derivedFromQuotationId: currentLatest._id,
                    },
                ],
                { session },
            );

            const newVersion = createdDocs[0];
            if (!newVersion) {
                throw new Error('Failed to create new quotation version');
            }

            await OutboxService.enqueue(
                {
                    dedupeKey: `quotation.superseded:${quotationGroupId}:${currentLatest.version}->${newVersion.version}`,
                    eventName: 'quotation.superseded',
                    aggregateType: 'quotationGroup',
                    aggregateId: quotationGroupId,
                    correlationId: getCorrelationId(),
                    payload: {
                        quotationGroupId,
                        supersededVersion: currentLatest.version,
                        newVersion: newVersion.version,
                    },
                },
                { session },
            );

            await session.commitTransaction();

            return newVersion;
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    }

    static async getQuotationByToken(token: string): Promise<IQuotation> {
        const payload = verifyQuotationToken(token);
        const quotation = await QuotationModel.findById(payload.quotationId).populate('clientId', 'name emails');
        if (!quotation) throw new AppError('Quotation not found', 404);

        if (!quotation.isLatestVersion || quotation.status === 'superseded') {
            throw new AppError('Link no longer active.', 410);
        }

        if (quotation.tokenExpiresAt && quotation.tokenExpiresAt < new Date()) {
            quotation.status = 'expired';
            await quotation.save();
            throw new AppError('Link expired.', 410);
        }

        if (quotation.status === 'sent') {
            assertTransition(quotation.status, 'viewed');
            quotation.status = 'viewed';
            await quotation.save();
            logger.info(
                {
                    quotationId: quotation._id.toString(),
                    quotationGroupId: quotation.quotationGroupId,
                    quotationVersion: quotation.version,
                    from: 'sent',
                    to: 'viewed',
                },
                'quotation.status_transition',
            );
        }

        return quotation;
    }

    static async acceptQuotation(token: string): Promise<IQuotation> {
        const payload = verifyQuotationToken(token);
        const quotation = await QuotationModel.findById(payload.quotationId);
        if (!quotation) throw new AppError('Quotation not found', 404);

        if (!quotation.isLatestVersion || quotation.status === 'superseded') {
            throw new AppError('Version inactive.', 410);
        }

        // Idempotent: already accepted => return without side effects
        if (quotation.status === 'accepted') return quotation;

        assertTransition(quotation.status, 'accepted');

        const updated = await QuotationModel.findOneAndUpdate(
            { _id: quotation._id, __v: quotation.__v, isLatestVersion: true, status: { $in: ['sent', 'viewed'] } },
            { $set: { status: 'accepted' } },
            { new: true },
        );

        if (!updated) {
            // Retry-safe: if the quotation became accepted between read and update, return it.
            const latest = await QuotationModel.findById(payload.quotationId);
            if (latest && latest.isLatestVersion && latest.status === 'accepted') return latest;
            throw new AppError('State changed concurrently', 409);
        }

        await quotationPaymentEventQueue.add('quotation.accepted', {
            quotationId: updated._id.toString(),
            quotationGroupId: updated.quotationGroupId,
            quotationVersion: updated.version,
            clientId: updated.clientId.toString(),
            grandTotal: updated.totals.grandTotal,
            currency: updated.currency || '৳',
            correlationId: getCorrelationId(),
            aggregateType: 'quotationGroup',
            aggregateId: updated.quotationGroupId,
        });

        logger.info(
            {
                quotationId: updated._id.toString(),
                quotationGroupId: updated.quotationGroupId,
                quotationVersion: updated.version,
                status: updated.status,
            },
            'quotation.accepted',
        );

        return updated;
    }

    static async requestChanges(token: string, reason: string): Promise<IQuotation> {
        const payload = verifyQuotationToken(token);
        const quotation = await QuotationModel.findById(payload.quotationId);
        if (!quotation) throw new AppError('Quotation not found', 404);

        if (!quotation.isLatestVersion || quotation.status === 'superseded') {
            throw new AppError('Version inactive.', 410);
        }

        // Idempotent: already requested changes with same reason
        if (quotation.status === 'change_requested' && quotation.changeRequestReason === reason) {
            return quotation;
        }

        assertTransition(quotation.status, 'change_requested');

        const updated = await QuotationModel.findOneAndUpdate(
            { _id: quotation._id, __v: quotation.__v, isLatestVersion: true, status: { $in: ['sent', 'viewed'] } },
            { $set: { status: 'change_requested', changeRequestReason: reason } },
            { new: true },
        );

        if (!updated) {
            // Retry-safe: if already moved to change_requested, return it
            const latest = await QuotationModel.findById(payload.quotationId);
            if (latest && latest.isLatestVersion && latest.status === 'change_requested') return latest;
            throw new AppError('State changed concurrently', 409);
        }

        await quotationPaymentEventQueue.add('quotation.change_requested', {
            quotationGroupId: updated.quotationGroupId,
            quotationId: updated._id.toString(),
            reason,
            correlationId: getCorrelationId(),
            aggregateType: 'quotationGroup',
            aggregateId: updated.quotationGroupId,
        });

        logger.info(
            {
                quotationId: updated._id.toString(),
                quotationGroupId: updated.quotationGroupId,
                quotationVersion: updated.version,
                status: updated.status,
            },
            'quotation.change_requested',
        );

        return updated;
    }

    static async getQuotations(filters: any = {}, options: any = {}) {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
        const skip = (page - 1) * limit;

        const mongoFilters: any = { ...filters };
        if (filters.search) {
            mongoFilters.$or = [
                { quotationNumber: { $regex: filters.search, $options: 'i' } },
                { 'details.title': { $regex: filters.search, $options: 'i' } },
                { 'client.contactName': { $regex: filters.search, $options: 'i' } },
            ];
            delete mongoFilters.search;
        }

        const [items, total] = await Promise.all([
            QuotationModel.find(mongoFilters).sort(sort).skip(skip).limit(limit).populate('clientId', 'name clientId emails').exec(),
            QuotationModel.countDocuments(mongoFilters),
        ]);

        return { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
    }

    static async getQuotationById(id: string): Promise<IQuotation | null> {
        return QuotationModel.findById(id).populate('clientId', 'name clientId emails');
    }

    static async getGroupVersions(quotationGroupId: string): Promise<IQuotation[]> {
        return QuotationModel.find({ quotationGroupId }).sort({ version: -1 }).populate('clientId', 'name clientId emails');
    }

    static async deleteQuotation(id: string): Promise<void> {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const quotation = await QuotationModel.findById(id).session(session);
            if (!quotation) throw new AppError('Quotation not found', 404);

            const quotationGroupId = quotation.quotationGroupId;
            if (quotation.orderId) {
                const OrderModel = (await import('../models/order.model.js')).default;
                await OrderModel.findByIdAndDelete(quotation.orderId).session(session);
            }
            const QuotationPaymentModel = (await import('../models/quotation-payment.model.js')).default;
            await QuotationPaymentModel.findOneAndDelete({ quotationGroupId }).session(session);

            const PaymentEventLogModel = (await import('../models/payment-event-log.model.js')).default;
            await PaymentEventLogModel.deleteMany({ quotationGroupId }).session(session);

            await quotation.deleteOne({ session });
            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    }
}
