import { Router } from 'express';
import LeadController from '../controllers/lead.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router: Router = Router();

router.get('/', requireAuth, LeadController.getAllLeads);
router.post('/', requireAuth, LeadController.createLead);
router.get('/:id', requireAuth, LeadController.getLeadById);
router.put('/:id', requireAuth, LeadController.updateLead);
router.post('/:id/activities', requireAuth, LeadController.addActivity);
router.post('/:id/convert', requireAuth, LeadController.convertToClient);

export const leadRoute = router;
