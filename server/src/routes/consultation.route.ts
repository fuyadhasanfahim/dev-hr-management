import express from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import ConsultationController from '../controllers/consultation.controller.js';

const router = express.Router();

// The public site (webbriks) and this app's own AI chat both create
// consultations by writing to the DB directly — nothing calls this HTTP
// endpoint anonymously, so it is guarded like the rest of the resource.
router.post('/', requirePermission('consultation.create'), ConsultationController.create);

// Admin only — manage consultations
router.get('/', requirePermission('consultation.read'), ConsultationController.getAll);
router.get('/stats', requirePermission('consultation.read'), ConsultationController.getStats);
router.get('/:id', requirePermission('consultation.read'), ConsultationController.getById);
router.patch('/:id', requirePermission('consultation.update'), ConsultationController.update);
router.delete('/:id', requirePermission('consultation.delete'), ConsultationController.remove);

export const ConsultationRoutes = router;
export default ConsultationRoutes;
