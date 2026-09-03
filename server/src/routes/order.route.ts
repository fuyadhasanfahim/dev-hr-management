import express from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import OrderController from '../controllers/order.controller.js';

const router = express.Router();

/**
 * POST / is intentionally BLOCKED.
 * Orders can ONLY be created via the quotation pipeline (POST /convert-quotation).
 * This guard prevents accidental re-enabling of manual order creation.
 */
router.post('/', (_req, res) => {
    res.status(405).json({
        success: false,
        message:
            'Method Not Allowed: Orders cannot be created manually. ' +
            'Convert an accepted quotation into an order via POST /convert-quotation instead.',
    });
});

router.get('/',         requirePermission('order.read'), OrderController.getAllOrders);
router.get('/:id',      requirePermission('order.read'), OrderController.getOrderById);
router.get('/:id/invoice/pdf', requirePermission('order.read'), OrderController.downloadInvoicePdf);

router.patch('/:id/status',         requirePermission('order.changeStatus'), OrderController.updateOrderStatus);
router.patch('/:id/team',           requirePermission('order.assign'), OrderController.updateOrderTeam);
router.post('/convert-quotation',    requirePermission('order.create'), OrderController.convertQuotationToOrder);

// Operational fields only (priority / internalNotes / estimatedDeliveryDate).
// The quotationSnapshot stays immutable.
router.patch('/:id',                requirePermission('order.update'), OrderController.updateOrder);

// Public asset delivery endpoint — accessToken is the credential (no JWT).
router.get('/client/:id/assets/:assetId', OrderController.getAssetPublic);

// Staff asset delivery endpoint (debug/admin use)
router.get('/:id/assets/:assetId',  requirePermission('order.read'), OrderController.getAsset);

export const OrderRoutes = router;
