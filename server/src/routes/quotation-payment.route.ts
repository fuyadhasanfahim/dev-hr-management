import { Router } from 'express';
import QuotationPaymentController from '../controllers/quotation-payment.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

const STAFF_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.TEAM_LEADER, Role.STAFF];

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

export const quotationPaymentRoute = router;
