import { Router } from 'express';
import LeadSettingController from '../controllers/lead-setting.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router: Router = Router();

router.get('/', requireAuth, LeadSettingController.getAllSettings);
router.post('/', requireAuth, LeadSettingController.createSetting);
router.put('/:id', requireAuth, LeadSettingController.updateSetting);
router.delete('/:id', requireAuth, LeadSettingController.deleteSetting);

export const leadSettingRoute = router;
