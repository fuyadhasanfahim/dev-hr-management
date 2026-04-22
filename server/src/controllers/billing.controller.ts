import { Request, Response } from 'express';
import BillingServices from '../services/billing.service.js';

async function generateInvoice(req: Request, res: Response) {
    try {
        const { orderId, projectId, milestoneId, dueDate } = req.body;
        
        let result;
        if (milestoneId && projectId) {
            result = await BillingServices.createInvoiceFromMilestone(projectId, milestoneId, new Date(dueDate));
        } else if (orderId) {
            result = await BillingServices.createInvoiceFromOrder(orderId, new Date(dueDate));
        } else {
            throw new Error('Either orderId or (projectId and milestoneId) must be provided');
        }

        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: (err as Error).message });
    }
}

async function getAllInvoices(req: Request, res: Response) {
    try {
        const result = await BillingServices.getAllInvoicesFromDB(req.query);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function getInvoiceById(req: Request, res: Response) {
    try {
        const result = await BillingServices.getInvoiceById(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Invoice not found' });
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: (err as Error).message });
    }
}

export default {
    generateInvoice,
    getAllInvoices,
    getInvoiceById,
};
