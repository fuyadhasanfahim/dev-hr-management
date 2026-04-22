import express from 'express';
import ServiceController from '../controllers/service.controller.js';

const router = express.Router();

router.post('/', ServiceController.createService);
router.get('/', ServiceController.getAllServices);
router.get('/:id', ServiceController.getServiceById);
router.patch('/:id', ServiceController.updateService);

export const ServiceRoutes = router;
