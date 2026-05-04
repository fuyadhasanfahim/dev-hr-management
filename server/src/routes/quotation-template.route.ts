import { Router } from 'express';
import QuotationTemplateController from '../controllers/quotation-template.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

const STAFF_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER, Role.TEAM_LEADER, Role.STAFF];
const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.ADMIN];

router.get('/', authorize(...STAFF_ROLES), QuotationTemplateController.getAllTemplates);
router.get('/:id', authorize(...STAFF_ROLES), QuotationTemplateController.getTemplateById);
router.post('/', authorize(...STAFF_ROLES), QuotationTemplateController.createTemplate);
router.patch('/:id', authorize(...STAFF_ROLES), QuotationTemplateController.updateTemplate);
router.delete('/:id', authorize(...ADMIN_ROLES), QuotationTemplateController.deleteTemplate);

export const quotationTemplateRoute = router;
