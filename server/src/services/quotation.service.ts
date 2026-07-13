import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import QuotationModel from '../models/quotation.model.js';
import { InvoiceCounter } from '../models/invoice-counter.model.js';
import type { IQuotation, IQuotationLineItem } from '../types/quotation.type.js';
import type { QuotationStatus } from '../types/quotation.type.js';
import { isUpfrontBillingCycle } from '../types/quotation.type.js';
import { AppError } from '../utils/AppError.js';
import { OutboxService } from './outbox.service.js';
import { getCorrelationId } from '../lib/requestContext.js';
import { logger } from '../lib/logger.js';
import ClientModel from '../models/client.model.js';
import emailService from './email.service.js';
import { sendClientSmsIfBDT } from './sms-notification.service.js';
import { ReceiptService } from './receipt.service.js';
import { QuotationPuppeteerPdfService } from './quotation-puppeteer-pdf.service.js';

import type { QuotationMilestoneEmailInfo } from '../templates/QuotationEmail.js';

export type RecipientSendStatus = {
    email: string;
    status: 'sent' | 'failed';
    error?: string;
};

type SendQuotationResult = {
    quotation: IQuotation;
    clientLink: string;
    emailSent: boolean;
    emailedTo?: string[];
    emailError?: string;
    recipients: RecipientSendStatus[];
};

const QUOTATION_TOKEN_SECRET = process.env.QUOTATION_TOKEN_SECRET;
const TOKEN_EXPIRY_DAYS = 30;

if (!QUOTATION_TOKEN_SECRET) {
    throw new Error('QUOTATION_TOKEN_SECRET env variable is required');
}

// ─── Calculation Helper ───────────────────────────────────────────────────────

function calculateTotals(data: Partial<IQuotation>): {
    totals: { subtotal: number; discountAmount: number; taxAmount: number; grandTotal: number };
    recurringCharges: IQuotationLineItem[];
} {
    const services = data.services || [];
    const recurringCharges: IQuotationLineItem[] = [];

    let discountAmount = 0;
    let subtotal = 0;
    let taxAmount = 0;

    for (const service of services) {
        const basePrice = service.basePrice || 0;

        // Per-line amount = price × (quantity ?? 1). Upfront cycles (one-time /
        // per-image / per-video) feed this service's totals; monthly/yearly
        // cycles are billed separately and are pulled out into recurringCharges.
        const upfrontLineItemsTotal = (service.lineItems || []).reduce((acc, item) => {
            if (isUpfrontBillingCycle(item.billingCycle)) {
                return acc + (item.price || 0) * (item.quantity ?? 1);
            }
            recurringCharges.push(item);
            return acc;
        }, 0);

        const serviceBase = basePrice + upfrontLineItemsTotal;
        const serviceDiscount = (serviceBase * (service.discount || 0)) / 100;
        const serviceSubtotal = serviceBase - serviceDiscount;
        const serviceTax = (serviceSubtotal * (service.taxRate || 0)) / 100;

        discountAmount += serviceDiscount;
        subtotal += serviceSubtotal;
        taxAmount += serviceTax;
    }

    const grandTotal = subtotal + taxAmount;

    return {
        totals: { subtotal, discountAmount, taxAmount, grandTotal },
        recurringCharges,
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
        algorithm: 'HS256',
    });
}

function verifyQuotationToken(token: string): QuotationTokenPayload {
    try {
        return jwt.verify(token, QUOTATION_TOKEN_SECRET!, {
            algorithms: ['HS256'],
        }) as QuotationTokenPayload;
    } catch (err: any) {
        const expired = err?.name === 'TokenExpiredError';
        throw new AppError(
            expired ? 'Quotation link has expired.' : 'Invalid quotation link.',
            410,
        );
    }
}

/**
 * Centralised token-based lookup that combines:
 *   1. JWT signature + expiry verification
 *   2. Token rotation guard (rejects forwarded/old tokens once a newer one is issued)
 *   3. Payload ↔ document consistency (group + version)
 *   4. tokenExpiresAt (DB) check, with status auto-flip to "expired"
 *   5. isLatestVersion / superseded gating
 *
 * Every public client endpoint must go through this — never `findById(payload.quotationId)`
 * directly — to keep all token guarantees consistent.
 */
async function resolveQuotationByToken(
    token: string,
    { populate = false }: { populate?: boolean } = {},
): Promise<IQuotation> {
    const payload = verifyQuotationToken(token);
    if (!payload?.quotationId) {
        throw new AppError('Invalid quotation link.', 410);
    }

    const query = QuotationModel.findById(payload.quotationId);
    if (populate) query.populate('clientId', 'name emails');
    const quotation = await query;
    if (!quotation) throw new AppError('Quotation not found', 404);

    // Token rotation guard — rejects any token that no longer matches what was last
    // emailed for this quotation (e.g. forwarded link from a previous email).
    if (!quotation.secureToken || quotation.secureToken !== token) {
        throw new AppError('This link has been replaced by a newer one.', 410);
    }

    if (payload.quotationGroupId && payload.quotationGroupId !== quotation.quotationGroupId) {
        throw new AppError('Invalid quotation link.', 410);
    }
    if (typeof payload.version === 'number' && payload.version !== quotation.version) {
        throw new AppError('Invalid quotation link.', 410);
    }

    if (quotation.tokenExpiresAt && quotation.tokenExpiresAt < new Date()) {
        if (quotation.isLatestVersion && quotation.status !== 'expired') {
            quotation.status = 'expired';
            await quotation.save();
        }
        throw new AppError('Quotation link has expired.', 410);
    }

    if (!quotation.isLatestVersion || quotation.status === 'superseded') {
        throw new AppError('This quotation link is no longer active.', 410);
    }

    return quotation;
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
        // Prevent accidental rapid duplicates: identical payload by same user within 5 minutes.
        const fingerprintPayload = (() => {
            const d: any = { ...(data as any) };
            // Strip fields that must not affect "same quotation" detection.
            delete d._id;
            delete d.__v;
            delete d.totals;
            delete d.status;
            delete d.secureToken;
            delete d.tokenExpiresAt;
            delete d.quotationNumber;
            delete d.quotationGroupId;
            delete d.version;
            delete d.isLatestVersion;
            delete d.createdBy;
            delete d.createdAt;
            delete d.updatedAt;
            delete d.versionCreationKey;
            delete d.derivedFromQuotationId;
            return d;
        })();

        const creationFingerprint = crypto
            .createHash('sha256')
            .update(stableStringify(fingerprintPayload))
            .digest('hex');

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const existing = await QuotationModel.findOne({
            createdBy: new Types.ObjectId(userId),
            creationFingerprint,
            createdAt: { $gte: fiveMinutesAgo },
        }).sort({ createdAt: -1 });

        if (existing) {
            throw new AppError(
                'A quotation with the same information was created recently. Please change at least one field and try again.',
                409,
            );
        }

        const quotationNumber = await generateQuotationNumber();
        const quotationGroupId = crypto.randomUUID();

        // Server-side calculation of totals for integrity
        const { totals, recurringCharges } = calculateTotals(data);

        const quotation = new QuotationModel({
            ...data,
            totals,
            recurringCharges,
            quotationNumber,
            quotationGroupId,
            version: 1,
            isLatestVersion: true,
            status: 'draft',
            createdBy: new Types.ObjectId(userId),
            creationFingerprint,
        });

        const savedQuotation = await quotation.save();

        try {
            await ReceiptService.createZeroPaymentReceipt(savedQuotation, userId);
        } catch (err) {
            logger.error(`Failed to create automatic zero-payment receipt: ${err}`);
        }

        return savedQuotation;
    }

    static async updateQuotation(
        id: string,
        data: Partial<IQuotation>,
        _userId?: string,
    ): Promise<IQuotation> {
        const quotation = await QuotationModel.findById(id);
        if (!quotation) throw new AppError('Quotation not found', 404);
        const editableStatuses = ['draft', 'sent', 'viewed'];
        if (!editableStatuses.includes(quotation.status)) {
            throw new AppError(
                `Cannot edit a ${quotation.status} quotation directly. Please create a new version instead.`,
                409,
            );
        }

        const { totals, recurringCharges } = calculateTotals({ ...quotation.toObject(), ...data });

        const { quotationGroupId: _g, version: _v, isLatestVersion: _l, ...safeData } = data as any;

        Object.assign(quotation, { ...safeData, totals, recurringCharges });
        return await quotation.save();
    }

    static async sendQuotation(
        id: string,
        _userId: string,
        recipientEmails?: string[],
        _includePaymentLink = false,
    ): Promise<SendQuotationResult> {
        const quotation = await QuotationModel.findById(id);
        if (!quotation) throw new AppError('Quotation not found', 404);

        // Resend semantics:
        // - Prevent sending if the quotation is in a terminal/invalid state.
        // - Always attempt to send email when this endpoint is called.
        // - Only move to `sent` when transitioning from draft; otherwise preserve state.
        if (['superseded', 'rejected', 'expired'].includes(quotation.status)) {
            throw new AppError(`Cannot send email for a ${quotation.status} quotation`, 400);
        }

        const hasValidToken =
            Boolean(quotation.secureToken) &&
            (!quotation.tokenExpiresAt || quotation.tokenExpiresAt >= new Date());

        const tokenExpiresAt = hasValidToken
            ? quotation.tokenExpiresAt ?? (() => {
                  const d = new Date();
                  d.setDate(d.getDate() + TOKEN_EXPIRY_DAYS);
                  return d;
              })()
            : (() => {
                  const d = new Date();
                  d.setDate(d.getDate() + TOKEN_EXPIRY_DAYS);
                  return d;
              })();

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

        let emailSent = false;
        let emailedTo: string[] | undefined;
        let emailError: string | undefined;
        const recipients: RecipientSendStatus[] = [];

        try {
            const client = await ClientModel.findById(saved.clientId).lean();
            const fromRequest = (recipientEmails ?? [])
                .map((e) => String(e || '').trim())
                .filter(Boolean);
            const fromClient = (client?.emails ?? []).map((e) => String(e || '').trim()).filter(Boolean);
            const toList = Array.from(new Set((fromRequest.length ? fromRequest : fromClient).filter(Boolean)));

            if (toList.length === 0) {
                emailError = 'Client has no emails on record';
            } else {
                let pdfBuffer: Buffer | undefined;
                try {
                    // Reuse the exact same Puppeteer-rendered PDF used for the download
                    // button, so the emailed attachment is byte-identical to what the
                    // client sees when they download it themselves.
                    const { buffer } = await QuotationPuppeteerPdfService.generatePdf(
                        saved._id.toString(),
                    );
                    pdfBuffer = buffer;
                } catch (e: any) {
                    logger.warn(
                        {
                            quotationId: saved._id.toString(),
                            error: e?.message || String(e),
                        },
                        'quotation.pdf_generation_failed',
                    );
                }

                const clientName = saved.client?.contactName || client?.name || 'Client';

                // Format the grand total in the quotation's currency for the email
                // summary card. Falls back gracefully if the currency code is invalid.
                const emailCurrency = saved.currency || 'USD';
                const grandTotal = saved.totals?.grandTotal ?? 0;
                let totalAmountFormatted: string | undefined;
                try {
                    totalAmountFormatted = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: emailCurrency,
                    }).format(grandTotal);
                } catch {
                    totalAmountFormatted = `${grandTotal} ${emailCurrency}`;
                }

                const commonPayload = {
                    clientName,
                    quotationTitle: saved.details?.title || 'Quotation',
                    quotationNumber: saved.quotationNumber,
                    totalAmountFormatted,
                    ...(saved.details?.validUntil
                        ? { validUntil: new Date(saved.details.validUntil).toLocaleDateString('en-GB') }
                        : {}),
                    // Initial email: show milestone breakdown.
                    ...(Array.isArray(saved.paymentMilestones) && saved.paymentMilestones.length > 0
                        ? (() => {
                              const currency = (saved.currency || 'USD').toUpperCase();
                              const fmt = (amount: number) => {
                                  try {
                                      return new Intl.NumberFormat('en-US', {
                                          style: 'currency',
                                          currency,
                                      }).format(amount);
                                  } catch {
                                      return `${amount} ${currency}`;
                                  }
                              };
                              const milestones: QuotationMilestoneEmailInfo[] = saved.paymentMilestones.map(
                                  (m: any) => ({
                                      label: String(m?.label || 'Milestone'),
                                      percentageLabel: `${Number(m?.percentage || 0)}%`,
                                      amountFormatted: fmt(((saved.totals?.grandTotal ?? 0) * Number(m?.percentage || 0)) / 100),
                                      ...(m?.note ? { note: String(m.note) } : {}),
                                  }),
                              );
                              return { milestones };
                          })()
                        : {}),
                    ...(pdfBuffer
                        ? {
                              attachment: {
                                  filename: `quotation_${saved.quotationNumber || saved._id.toString()}.pdf`,
                                  content: pdfBuffer,
                                  contentType: 'application/pdf',
                              },
                              hasPdfAttachment: true,
                          }
                        : {}),
                };

                await Promise.all(
                    toList.map(async (to) => {
                        try {
                            await emailService.sendQuotationEmail({ to, ...commonPayload });
                            recipients.push({ email: to, status: 'sent' });
                        } catch (e: any) {
                            recipients.push({
                                email: to,
                                status: 'failed',
                                error: e?.message || String(e),
                            });
                        }
                    })
                );

                const successes = recipients.filter((r) => r.status === 'sent');
                const failures = recipients.filter((r) => r.status === 'failed');

                emailSent = successes.length > 0;
                emailedTo = successes.length ? successes.map((r) => r.email) : undefined;
                if (!emailSent) {
                    emailError =
                        failures.length > 0
                            ? `Failed to send email: ${failures
                                  .map((f) => `${f.email} (${f.error ?? 'unknown error'})`)
                                  .join('; ')}`
                            : 'Failed to send email';
                } else if (failures.length > 0) {
                    emailError = `Email sent to ${successes.length} recipient(s); failed for ${failures.length}.`;
                }

                // SMS for BDT-currency clients
                if (emailSent && saved.clientId) {
                    const emailsStr = emailedTo ? emailedTo.join(', ') : 'your email';
                    const smsMsg = `A quotation (${saved.quotationNumber}) has been sent to ${emailsStr}, please check. - WebBriks`;
                    sendClientSmsIfBDT(saved.clientId.toString(), smsMsg).catch((err: any) =>
                        logger.error({ err }, 'quotation.send_sms.failed'),
                    );
                }
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
            clientLink: '',
            emailSent,
            recipients,
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
            const { totals, recurringCharges } = calculateTotals({ ...baseData, ...data });

            const createdDocs = await QuotationModel.create(
                [
                    {
                        ...baseData,
                        ...data,
                        totals,
                        recurringCharges,
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
                    correlationId: getCorrelationId() || '',
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
        const quotation = await resolveQuotationByToken(token, { populate: true });

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
        const quotation = await resolveQuotationByToken(token);

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
            const latest = await QuotationModel.findById(quotation._id);
            if (latest && latest.isLatestVersion && latest.status === 'accepted') return latest;
            throw new AppError('State changed concurrently', 409);
        }

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
        const quotation = await resolveQuotationByToken(token);

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
            const latest = await QuotationModel.findById(quotation._id);
            if (latest && latest.isLatestVersion && latest.status === 'change_requested') return latest;
            throw new AppError('State changed concurrently', 409);
        }

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
            if (quotation.orderId) {
                const OrderModel = (await import('../models/order.model.js')).default;
                await OrderModel.findByIdAndDelete(quotation.orderId).session(session);
            }

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
