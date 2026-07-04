import { Router } from 'express';
import ReceiptController from '../controllers/receipt.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

// Narrower than the usual STAFF_ROLES — receipts expose financial totals, and
// the user explicitly scoped this feature to Super Admin, Admin, Team Leader.
const RECEIPT_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.TEAM_LEADER];
const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.ADMIN];

router.get('/', authorize(...RECEIPT_ROLES), ReceiptController.getAllReceipts);
router.get(
    '/summary/:quotationGroupId',
    authorize(...RECEIPT_ROLES),
    ReceiptController.getPaymentSummary,
);
router.get('/:id', authorize(...RECEIPT_ROLES), ReceiptController.getReceiptById);
router.get(
    '/:id/pdf/puppeteer',
    authorize(...RECEIPT_ROLES),
    ReceiptController.downloadReceiptPdfPuppeteer,
);

router.post('/', authorize(...RECEIPT_ROLES), ReceiptController.createReceipt);
router.post('/:id/send', authorize(...RECEIPT_ROLES), ReceiptController.sendReceipt);

router.patch('/:id/void', authorize(...RECEIPT_ROLES), ReceiptController.voidReceipt);

router.delete('/:id', authorize(...ADMIN_ROLES), ReceiptController.deleteReceipt);

export const receiptRoute = router;
