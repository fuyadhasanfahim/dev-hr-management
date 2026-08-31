import express from 'express';
import ServiceController from '../controllers/service.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router = express.Router();

// GET stays open to any authenticated user — the service catalogue is needed
// when building quotations/orders across roles.
router.post('/', requirePermission('service.create'), ServiceController.createService);
router.get('/', ServiceController.getAllServices);
router.get('/:id', ServiceController.getServiceById);
router.patch('/:id', requirePermission('service.update'), ServiceController.updateService);

export const ServiceRoutes = router;
