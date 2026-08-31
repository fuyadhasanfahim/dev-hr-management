import express from 'express';
import BillingController from '../controllers/billing.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router = express.Router();

router.post('/generate', requirePermission('invoice.create'), BillingController.generateInvoice);
router.get('/', requirePermission('invoice.read'), BillingController.getAllInvoices);
router.get('/:id', requirePermission('invoice.read'), BillingController.getInvoiceById);

export const BillingRoutes = router;
