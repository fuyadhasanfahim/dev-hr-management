import { Router } from 'express';
import QuotationController from '../controllers/quotation.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

const STAFF_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.TEAM_LEADER, Role.STAFF];
const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.ADMIN];

// ─── Public Client Routes (token-authenticated — no JWT auth middleware) ───────
// These MUST be registered before the authorize middleware routes
router.get('/client/:token',            QuotationController.viewQuotationByToken);
router.post('/client/:token/accept',    QuotationController.acceptQuotation);
router.post('/client/:token/changes',   QuotationController.requestChanges);

// ─── Staff / Admin Routes ─────────────────────────────────────────────────────
router.get('/',                         authorize(...STAFF_ROLES), QuotationController.getAllQuotations);
router.get('/group/:groupId/versions',  authorize(...STAFF_ROLES), QuotationController.getGroupVersions);
router.get('/:id',                      authorize(...STAFF_ROLES), QuotationController.getQuotationById);

router.post('/',                        authorize(...STAFF_ROLES), QuotationController.createQuotation);
router.post('/:id/send',                authorize(...STAFF_ROLES), QuotationController.sendQuotation);
router.post('/group/:groupId/version',  authorize(...STAFF_ROLES), QuotationController.createNewVersion);

router.patch('/:id',                    authorize(...STAFF_ROLES), QuotationController.updateQuotation);

router.delete('/:id',                   authorize(...ADMIN_ROLES), QuotationController.deleteQuotation);

export const quotationRoute = router;
