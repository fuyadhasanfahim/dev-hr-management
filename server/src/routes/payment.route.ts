import express from 'express';
import PaymentController from '../controllers/payment.controller.js';

const router = express.Router();

router.post('/', PaymentController.recordPayment);
router.get('/', PaymentController.getAllPayments);

export const PaymentRoutes = router;
