import { type Request, type Response } from 'express';
import PaymentServices from '../services/payment.service.js';

async function recordPayment(req: Request, res: Response) {
    try {
        const userId = req.user?.id;
        const result = await PaymentServices.recordPaymentInDB({
            ...req.body,
            createdBy: userId,
        });
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: (err as Error).message });
    }
}

async function getAllPayments(req: Request, res: Response) {
    try {
        const result = await PaymentServices.getAllPaymentsFromDB(req.query);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: (err as Error).message });
    }
}

export default {
    recordPayment,
    getAllPayments,
};
