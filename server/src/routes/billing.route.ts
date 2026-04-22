import express from 'express';
import BillingController from '../controllers/billing.controller.js';

const router = express.Router();

router.post('/generate', BillingController.generateInvoice);
router.get('/', BillingController.getAllInvoices);
router.get('/:id', BillingController.getInvoiceById);

export const BillingRoutes = router;
