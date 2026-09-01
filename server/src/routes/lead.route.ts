import { Router } from 'express';
import LeadController from '../controllers/lead.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router: Router = Router();

// `requireAuth` already ran on the /api gate (app.ts); these add the
// permission check on top.
router.get('/', requirePermission('lead.read'), LeadController.getAllLeads);
router.post('/', requirePermission('lead.create'), LeadController.createLead);
router.get('/:id', requirePermission('lead.read'), LeadController.getLeadById);
router.put('/:id', requirePermission('lead.update'), LeadController.updateLead);
router.post(
    '/:id/activities',
    requirePermission('lead.update'),
    LeadController.addActivity,
);
router.post(
    '/:id/convert',
    requirePermission('lead.convert'),
    LeadController.convertToClient,
);

export const leadRoute = router;
