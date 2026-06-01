import express from 'express';
import ConsultationController from '../controllers/consultation.controller.js';
import { requireAuth, restrictTo } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public — AI chat creates consultation requests (no auth)
router.post('/', ConsultationController.create);

// Admin only — manage consultations
router.get('/', requireAuth, restrictTo('Admin', 'Super Admin'), ConsultationController.getAll);
router.get('/stats', requireAuth, restrictTo('Admin', 'Super Admin'), ConsultationController.getStats);
router.get('/:id', requireAuth, restrictTo('Admin', 'Super Admin'), ConsultationController.getById);
router.patch('/:id', requireAuth, restrictTo('Admin', 'Super Admin'), ConsultationController.update);
router.delete('/:id', requireAuth, restrictTo('Admin', 'Super Admin'), ConsultationController.remove);

export const ConsultationRoutes = router;
export default ConsultationRoutes;
