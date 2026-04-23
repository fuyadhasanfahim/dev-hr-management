import { Router } from 'express';
import QuotationController from '../controllers/quotation.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

// requireAuth is applied globally in app.ts, so we don't need it here.
// authorize middleware handles both authentication (checks req.user) and role authorization.

router.get('/', QuotationController.getAllQuotations);
router.get('/:id', QuotationController.getQuotationById);
router.post('/', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.TEAM_LEADER, Role.STAFF), QuotationController.createQuotation);
router.patch('/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.TEAM_LEADER, Role.STAFF), QuotationController.updateQuotation);
router.delete('/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN), QuotationController.deleteQuotation);

export const quotationRoute = router;
