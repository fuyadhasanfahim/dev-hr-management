import express from 'express';
import WhatsAppController from '../controllers/whatsapp.controller.js';

const router = express.Router();

router.get('/webhook', WhatsAppController.verifyWebhook);
router.post('/webhook', WhatsAppController.receiveWebhook);

export const WhatsAppRoutes = router;
export default WhatsAppRoutes;
