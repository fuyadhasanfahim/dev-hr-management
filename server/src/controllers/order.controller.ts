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

async function getAllOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
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

async function getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params;
        if (!id) {
            next(new AppError('Order id is required', 400));
            return;
        }

        const result = await OrderService.getOrderByIdFromDB(id);
        if (!result) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/**
 * Update order status via the state machine.
 * Only valid transitions are accepted — invalid ones throw 409.
 */
async function updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { status, note, sendEmail, customEmailMessage, selectedEmails } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            next(new AppError('Unauthorized', 401));
            return;
        }
        if (!req.params.id) {
            next(new AppError('Order id is required', 400));
            return;
        }
        if (!status) {
            next(new AppError('Status is required', 400));
            return;
        }

        const result = await OrderService.transitionStatus(
            req.params.id,
            status,
            userId,
            note,
            {
                sendEmail,
                customEmailMessage,
                selectedEmails,
            },
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
async function markDelivered(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.id;
        if (!userId) {
            next(new AppError('Unauthorized', 401));
            return;
        }
        if (!req.params.id) {
            next(new AppError('Order id is required', 400));
            return;
        }

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
async function getAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id, assetId } = req.params;
        const { accessToken } = req.query as { accessToken: string };

        if (!id) {
            next(new AppError('Order id is required', 400));
            return;
        }
        if (!assetId) {
            next(new AppError('assetId is required', 400));
            return;
        }
        if (!accessToken) {
            next(new AppError('accessToken query parameter is required', 400));
            return;
        }

        const asset = await OrderService.getAssetByAccessToken(id, assetId, accessToken);
        res.status(200).json({ success: true, data: asset });
    } catch (err) {
        next(err);
    }
}

/**
 * Public/client endpoint: serve an unlocked asset using accessToken only.
 * No JWT required; the accessToken is the credential.
 */
async function getAssetPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id, assetId } = req.params;
        const { accessToken } = req.query as { accessToken: string };

        if (!id) {
            next(new AppError('Order id is required', 400));
            return;
        }
        if (!assetId) {
            next(new AppError('assetId is required', 400));
            return;
        }
        if (!accessToken) {
            next(new AppError('accessToken query parameter is required', 400));
            return;
        }

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
    getAssetPublic,
};
