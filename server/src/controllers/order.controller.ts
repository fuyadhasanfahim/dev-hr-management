import type { Request, Response, NextFunction } from 'express';
import OrderService from '../services/order.service.js';
import { AppError } from '../utils/AppError.js';
import { maskOrder, maskOrders } from '../utils/masking.js';

/**
 * CRITICAL: POST / (createOrder) has been intentionally removed.
 *
 * Orders MUST only be created through the quotation pipeline via
 * POST /api/orders/convert-quotation (staff-triggered, see convertQuotationToOrder).
 *
 * Any attempt to POST /api/orders directly is blocked at the router level with a 405.
 */

async function getAllOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await OrderService.getAllOrdersFromDB(req.query);
        
        // Inject logic masking for staff
        if (result.data && Array.isArray(result.data)) {
            result.data = maskOrders(result.data, req.user?.role);
        }

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
        
        const sanitized = maskOrder(result, req.user?.role);
        res.status(200).json({ success: true, data: sanitized });
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
        const { status, note } = req.body;
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
        );
        const sanitized = maskOrder(result, req.user?.role);
        res.status(200).json({ success: true, data: sanitized });
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

/**
 * Explicit staff command to manually create an order from an existing accepted quotation.
 */
async function convertQuotationToOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { quotationGroupId } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            next(new AppError('Unauthorized', 401));
            return;
        }

        if (!quotationGroupId) {
            next(new AppError('quotationGroupId is required', 400));
            return;
        }

        const result = await OrderService.createOrderFromQuotation(quotationGroupId, userId);
        const sanitized = maskOrder(result, req.user?.role);

        res.status(201).json({
            success: true,
            message: 'Order successfully created from quotation',
            data: sanitized,
        });
    } catch (err) {
        next(err);
    }
}

async function updateOrderTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params;
        const { assignedTeam, teamLeader } = req.body;
        
        if (!id) {
            next(new AppError('Order id is required', 400));
            return;
        }

        const result = await OrderService.updateOrderTeam(id, { assignedTeam, teamLeader });
        const sanitized = maskOrder(result, req.user?.role);

        res.status(200).json({
            success: true,
            message: 'Order team updated successfully',
            data: sanitized,
        });
    } catch (err) {
        next(err);
    }
}

export default {
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    getAsset,
    getAssetPublic,
    convertQuotationToOrder,
    updateOrderTeam,
};
