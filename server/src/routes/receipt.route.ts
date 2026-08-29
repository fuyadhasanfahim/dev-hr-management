import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import ReceiptController from '../controllers/receipt.controller.js';

const router: Router = Router();


// ── List & detail ─────────────────────────────────────────────────────────────
router.get('/', requirePermission('receipt.read'), ReceiptController.getAllReceipts);
router.get('/summary/:quotationGroupId', requirePermission('receipt.read'), ReceiptController.getPaymentSummary);
router.get('/:id', requirePermission('receipt.read'), ReceiptController.getReceiptById);
router.get('/:id/pdf/puppeteer', requirePermission('receipt.read'), ReceiptController.downloadReceiptPdfPuppeteer);

// ── Payment operations ────────────────────────────────────────────────────────
router.post('/:id/payments', requirePermission('receipt.create'), ReceiptController.addPayment);
router.patch('/:id/payments/:paymentId/void', requirePermission('receipt.update'), ReceiptController.voidPayment);

// ── Receipt lifecycle ─────────────────────────────────────────────────────────
router.post('/:id/send', requirePermission('receipt.create'), ReceiptController.sendReceipt);
router.patch('/:id/void', requirePermission('receipt.update'), ReceiptController.voidReceipt);
router.delete('/:id', requirePermission('receipt.delete'), ReceiptController.deleteReceipt);

export const receiptRoute = router;
