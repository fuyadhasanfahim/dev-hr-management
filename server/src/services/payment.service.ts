import PaymentModel, { type IPayment, PaymentStatus } from '../models/payment.model.js';
import InvoiceModel from '../models/invoice.model.js';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import AuditService from './audit.service.js';

async function recordPaymentInDB(payload: Partial<IPayment>) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        if (payload.transactionId) {
            const existing = await PaymentModel.findOne({ transactionId: payload.transactionId });
            if (existing) {
                throw new AppError('Duplicate transaction ID', 400);
            }
        }

        const invoice = await InvoiceModel.findById(payload.invoiceId).session(session);
        if (!invoice) throw new AppError('Invoice not found', 404);

        // Prevent overpayment
        if (payload.amount && payload.amount > invoice.dueAmount) {
            throw new AppError(`Payment amount (${payload.amount}) exceeds due amount (${invoice.dueAmount})`, 400);
        }

        // 1. Create Payment record
        const [payment] = await PaymentModel.create([payload], { session });

        if (!payment) {throw new AppError('Payment not created', 400);}

        if (payment.status === PaymentStatus.COMPLETED) {
            // 2. Update Invoice
            invoice.paidAmount += payment.amount;
            // The pre-save hook in Invoice model will handle paymentStatus and dueAmount logic
            await invoice.save({ session });
        }

        // Audit Log
        if (payload.createdBy) {
            await AuditService.createLog({
                userId: payload.createdBy.toString(),
                action: 'RECORD_PAYMENT',
                entity: 'Payment',
                entityId: payment._id.toString(),
                details: { amount: payment.amount, invoiceId: payment.invoiceId },
            });
        }

        await session.commitTransaction();
        return payment;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
}


async function getAllPaymentsFromDB(query: any) {
    const { invoiceId, status, page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const filter: any = {};
    if (invoiceId) filter.invoiceId = invoiceId;
    if (status) filter.status = status;

    const payments = await PaymentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();
        
    const total = await PaymentModel.countDocuments(filter);

    return {
        payments,
        meta: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPage: Math.ceil(total / Number(limit)),
        }
    };
}

export default {
    recordPaymentInDB,
    getAllPaymentsFromDB
};

