import express from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import ConsultationController from '../controllers/consultation.controller.js';

const router = express.Router();

// Public — AI chat creates consultation requests (no auth)
router.post('/', ConsultationController.create);

// Admin only — manage consultations
router.get('/', requirePermission('consultation.read'), ConsultationController.getAll);
router.get('/stats', requirePermission('consultation.read'), ConsultationController.getStats);
router.get('/:id', requirePermission('consultation.read'), ConsultationController.getById);
router.patch('/:id', requirePermission('consultation.update'), ConsultationController.update);
router.delete('/:id', requirePermission('consultation.delete'), ConsultationController.remove);

export const ConsultationRoutes = router;
export default ConsultationRoutes;
