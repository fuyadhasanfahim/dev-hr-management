import type { Request, Response, NextFunction } from 'express';
import OrderService from '../services/order.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * CRITICAL: POST / (createOrder) has been intentionally removed.
 *
 * Orders MUST only be created through the quotation pipeline:
 *   quotation accepted → upfront payment webhook → event worker → createOrderFromQuotation()
 *
 * Any attempt to POST /api/orders directly is blocked at the router level with a 405.
 */

async function getAllOrders(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await OrderService.getAllOrdersFromDB(req.query);
        res.status(200).json({
            success: true,
            message: 'Orders fetched successfully',
            ...result,
        });
    } catch (err) {
        next(err);
    }
}

async function getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await OrderService.getOrderByIdFromDB(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Order not found' });
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/**
 * Update order status via the state machine.
 * Only valid transitions are accepted — invalid ones throw 409.
 */
async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const { status, note } = req.body;
        const userId = req.user?.id;
        if (!userId) return next(new AppError('Unauthorized', 401));
        if (!status) return next(new AppError('Status is required', 400));

        const result = await OrderService.transitionStatus(
            req.params.id,
            status,
            userId,
            note,
        );
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/**
 * Staff marks an order as delivered.
 * Requires at least one asset to be uploaded first.
 */
async function markDelivered(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user?.id;
        if (!userId) return next(new AppError('Unauthorized', 401));

        const result = await OrderService.markDelivered(req.params.id, userId);
        res.status(200).json({
            success: true,
            message: 'Order marked as delivered. Client has been notified.',
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Serve a locked asset after validating the client's access token.
 * The asset value is only returned when:
 *  1. isLocked = false (delivery payment completed)
 *  2. accessToken is valid and not expired
 */
async function getAsset(req: Request, res: Response, next: NextFunction) {
    try {
        const { id, assetId } = req.params;
        const { accessToken } = req.query as { accessToken: string };

        if (!accessToken) return next(new AppError('accessToken query parameter is required', 400));

        const asset = await OrderService.getAssetByAccessToken(id, assetId, accessToken);
        res.status(200).json({ success: true, data: asset });
    } catch (err) {
        next(err);
    }
}

export default {
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    markDelivered,
    getAsset,
};
