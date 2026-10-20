import { Router } from 'express';
import AiSettingsController from '../controllers/ai-settings.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router: Router = Router();

router.get('/status', requireAuth, AiSettingsController.status);
router.get('/', requireAuth, requirePermission('ai.read'), AiSettingsController.get);
router.put('/', requireAuth, requirePermission('ai.manage'), AiSettingsController.update);

export const aiSettingsRoute = router;
