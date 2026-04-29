import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import QuotationModel from '../models/quotation.model.js';
import { InvoiceCounter } from '../models/invoice-counter.model.js';
import type { IQuotation } from '../types/quotation.type.js';
import { AppError } from '../utils/AppError.js';
import { quotationPaymentEventQueue } from './queue.service.js';

const QUOTATION_TOKEN_SECRET = process.env.QUOTATION_TOKEN_SECRET;
const TOKEN_EXPIRY_DAYS = 30;

if (!QUOTATION_TOKEN_SECRET) {
    throw new Error('QUOTATION_TOKEN_SECRET env variable is required');
}

// ─── Calculation Helper ───────────────────────────────────────────────────────

function calculateTotals(data: Partial<IQuotation>) {
    const basePrice = data.pricing?.basePrice || 0;
    const additionalServicesTotal = data.additionalServices?.reduce((acc, s) => acc + (s.price || 0), 0) || 0;
    const discountAmount = data.pricing?.discount || 0;
    const taxRate = data.pricing?.taxRate || 0;

    const subtotal = basePrice + additionalServicesTotal - discountAmount;
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

    static async sendQuotation(id: string, _userId: string): Promise<IQuotation> {
        const quotation = await QuotationModel.findById(id);
        if (!quotation) throw new AppError('Quotation not found', 404);
        if (quotation.status !== 'draft') {
            throw new AppError('Only draft quotations can be sent', 409);
        }

        const tokenExpiresAt = new Date();
        tokenExpiresAt.setDate(tokenExpiresAt.getDate() + TOKEN_EXPIRY_DAYS);

        const secureToken = signQuotationToken({
            quotationGroupId: quotation.quotationGroupId,
            quotationId: quotation._id.toString(),
            version: quotation.version,
        });

        quotation.status = 'sent';
        quotation.secureToken = secureToken;
        quotation.tokenExpiresAt = tokenExpiresAt;

        return await quotation.save();
    }

    static async createNewVersion(
        quotationGroupId: string,
        data: Partial<IQuotation>,
        userId: string,
    ): Promise<IQuotation> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
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
                    },
                ],
                { session },
            );

            const newVersion = createdDocs[0];
            if (!newVersion) {
                throw new Error('Failed to create new quotation version');
            }

            await session.commitTransaction();

            await quotationPaymentEventQueue.add('quotation.superseded', {
                quotationGroupId,
                supersededVersion: currentLatest.version,
                newVersion: newVersion.version,
            });

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
            quotation.status = 'viewed';
            await quotation.save();
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

        const updated = await QuotationModel.findOneAndUpdate(
            { _id: quotation._id, __v: quotation.__v, isLatestVersion: true, status: { $in: ['sent', 'viewed'] } },
            { $set: { status: 'accepted' } },
            { new: true },
        );

        if (!updated) throw new AppError('State changed concurrently', 409);

        await quotationPaymentEventQueue.add('quotation.accepted', {
            quotationId: updated._id.toString(),
            quotationGroupId: updated.quotationGroupId,
            clientId: updated.clientId.toString(),
            grandTotal: updated.totals.grandTotal,
            currency: '৳', // Default or from snapshot
        });

        return updated;
    }

    static async requestChanges(token: string, reason: string): Promise<IQuotation> {
        const payload = verifyQuotationToken(token);
        const quotation = await QuotationModel.findById(payload.quotationId);
        if (!quotation) throw new AppError('Quotation not found', 404);

        const updated = await QuotationModel.findOneAndUpdate(
            { _id: quotation._id, __v: quotation.__v, isLatestVersion: true },
            { $set: { status: 'change_requested', changeRequestReason: reason } },
            { new: true },
        );

        if (!updated) throw new AppError('State changed concurrently', 409);

        await quotationPaymentEventQueue.add('quotation.change_requested', {
            quotationGroupId: updated.quotationGroupId,
            quotationId: updated._id.toString(),
            reason,
        });

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
