import express from 'express';
import OrderController from '../controllers/order.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router = express.Router();

const STAFF_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.TEAM_LEADER, Role.STAFF];


/**
 * POST / is intentionally BLOCKED.
 * Orders can ONLY be created via the quotation pipeline (quotation accepted → upfront payment → event worker).
 * This guard prevents accidental re-enabling of manual order creation.
 */
router.post('/', (_req, res) => {
    res.status(405).json({
        success: false,
        message:
            'Method Not Allowed: Orders cannot be created manually. ' +
            'Orders are automatically created after a quotation is accepted and upfront payment is confirmed.',
    });
});

router.get('/',         authorize(...STAFF_ROLES), OrderController.getAllOrders);
router.get('/:id',      authorize(...STAFF_ROLES), OrderController.getOrderById);

router.patch('/:id/status',         authorize(...STAFF_ROLES), OrderController.updateOrderStatus);
router.post('/:id/deliver',         authorize(...STAFF_ROLES), OrderController.markDelivered);

// Public asset delivery endpoint — accessToken is the credential (no JWT).
router.get('/client/:id/assets/:assetId', OrderController.getAssetPublic);

// Staff asset delivery endpoint (debug/admin use)
router.get('/:id/assets/:assetId',  authorize(...STAFF_ROLES), OrderController.getAsset);

export const OrderRoutes = router;
