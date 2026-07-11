import { Router } from 'express';
import ReceiptController from '../controllers/receipt.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

const RECEIPT_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.TEAM_LEADER];
const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.ADMIN];

// ── List & detail ─────────────────────────────────────────────────────────────
router.get('/', authorize(...RECEIPT_ROLES), ReceiptController.getAllReceipts);
router.get('/summary/:quotationGroupId', authorize(...RECEIPT_ROLES), ReceiptController.getPaymentSummary);
router.get('/:id', authorize(...RECEIPT_ROLES), ReceiptController.getReceiptById);
router.get('/:id/pdf/puppeteer', authorize(...RECEIPT_ROLES), ReceiptController.downloadReceiptPdfPuppeteer);

// ── Payment operations ────────────────────────────────────────────────────────
router.post('/:id/payments', authorize(...RECEIPT_ROLES), ReceiptController.addPayment);
router.patch('/:id/payments/:paymentId/void', authorize(...RECEIPT_ROLES), ReceiptController.voidPayment);

// ── Receipt lifecycle ─────────────────────────────────────────────────────────
router.post('/:id/send', authorize(...RECEIPT_ROLES), ReceiptController.sendReceipt);
router.patch('/:id/void', authorize(...RECEIPT_ROLES), ReceiptController.voidReceipt);
router.delete('/:id', authorize(...ADMIN_ROLES), ReceiptController.deleteReceipt);

export const receiptRoute = router;
