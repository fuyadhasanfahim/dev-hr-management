import { Router } from 'express';
import QuotationPaymentController from '../controllers/quotation-payment.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

const STAFF_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.TEAM_LEADER, Role.STAFF];

// ─── Public Client Routes (token-authenticated — no JWT auth middleware) ───────
// Token itself is the credential, enforced server-side.
router.post('/client/:token/intent', QuotationPaymentController.createClientPaymentIntent);
router.post('/client/:token/capture', QuotationPaymentController.captureClientPayPalOrder);
router.get('/client/:token/status', QuotationPaymentController.getClientPaymentStatus);
router.post('/client/:token/confirm', QuotationPaymentController.confirmClientPayment);

/**
 * POST /api/quotation-payments/intent
 * Create a Stripe PaymentIntent or PayPal order for a specific payment phase.
 * Body: { quotationGroupId, phase: 'upfront' | 'delivery' | 'final', provider?: 'stripe' | 'paypal' }
 *
 * This endpoint is accessible to authenticated staff/admin who initiate payment links,
 * OR can be opened to authenticated clients depending on your frontend flow.
 */
router.post('/intent', authorize(...STAFF_ROLES), QuotationPaymentController.createPaymentIntent);

/**
 * GET /api/quotation-payments/:groupId/status
 * Returns full payment phase breakdown for a quotation group.
 */
router.get('/:groupId/status', authorize(...STAFF_ROLES), QuotationPaymentController.getPaymentStatus);

// Utility: backfill missing orders (upfront paid but no orderId)
router.post('/reconcile-orders', authorize(...STAFF_ROLES), QuotationPaymentController.reconcileMissingOrders);

export const quotationPaymentRoute = router;
