import express from 'express';
import OrderController from '../controllers/order.controller.js';

const router = express.Router();

router.post('/', OrderController.createOrder);
router.get('/', OrderController.getAllOrders);
router.get('/:id', OrderController.getOrderById);
router.patch('/:id/status', OrderController.updateOrderStatus);

export const OrderRoutes = router;
