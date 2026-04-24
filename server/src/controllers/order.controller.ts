import type { Request, Response } from 'express';
import OrderServices from '../services/order.service.js';

async function createOrder(req: Request, res: Response) {
    try {
        const userId = req.user?.id;
        const result = await OrderServices.createOrderInDB({
            ...req.body,
            createdBy: userId,
        });
        return res.status(201).json({ success: true, data: result });
    } catch (err) {
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

async function getAllOrders(req: Request, res: Response) {
    try {
        const result = await OrderServices.getAllOrdersFromDB(req.query);
        return res.status(200).json({ 
            success: true, 
            message: 'Orders fetched successfully',
            ...result 
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function getOrderById(req: Request, res: Response) {
    try {
        const result = await OrderServices.getOrderByIdFromDB(req.params.id as string);
        if (!result) return res.status(404).json({ success: false, message: 'Order not found' });
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function updateOrderStatus(req: Request, res: Response) {
    try {
        const { status, note } = req.body;
        const userId = req.user?.id;
        if (!userId) throw new Error('Unauthorized');

        const result = await OrderServices.updateOrderStatusInDB(req.params.id as string, status, userId, note);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

export default {
    createOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
};
