import QuotationModel from '../models/quotation.model.js';
import { InvoiceCounter } from '../models/invoice-counter.model.js';
import type { IQuotation } from '../types/quotation.type.js';
import { Types } from 'mongoose';

export class QuotationService {
    static async generateQuotationNumber(): Promise<string> {
        const date = new Date();
        const year = date.getFullYear();
        
        const counter = await InvoiceCounter.findByIdAndUpdate(
            { _id: `quotation_${year}` },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        const sequence = counter.seq.toString().padStart(4, '0');
        return `QTN-${year}-${sequence}`;
    }

    static async createQuotation(data: Partial<IQuotation>, userId: string): Promise<IQuotation> {
        const quotationNumber = await this.generateQuotationNumber();
        
        const quotation = new QuotationModel({
            ...data,
            quotationNumber,
            createdBy: new Types.ObjectId(userId),
        });

        return await quotation.save();
    }

    static async updateQuotation(id: string, data: Partial<IQuotation>): Promise<IQuotation | null> {
        return await QuotationModel.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true }
        );
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

        const query = QuotationModel.find(mongoFilters)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('clientId', 'name clientId emails');

        const [items, total] = await Promise.all([
            query.exec(),
            QuotationModel.countDocuments(filters),
        ]);

        return {
            items,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
        };
    }

    static async getQuotationById(id: string): Promise<IQuotation | null> {
        return await QuotationModel.findById(id).populate('clientId', 'name clientId emails');
    }

    static async deleteQuotation(id: string): Promise<IQuotation | null> {
        return await QuotationModel.findByIdAndDelete(id);
    }
}
