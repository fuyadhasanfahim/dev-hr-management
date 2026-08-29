import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import QuotationController from '../controllers/quotation.controller.js';

const router: Router = Router();

// ─── Public client routes (no session / no staff authorize) ─────────────────
router.get('/client/:token', QuotationController.viewQuotationByToken);
router.post('/client/:token/accept', QuotationController.acceptQuotation);
router.post('/client/:token/changes', QuotationController.requestChanges);
router.get(
    '/:id/pdf/puppeteer',
    QuotationController.downloadQuotationPdfPuppeteer,
);

// ─── Staff / Admin Routes ─────────────────────────────────────────────────────
router.get(
    '/',
    requirePermission('quotation.read'),
    QuotationController.getAllQuotations,
);
router.get(
    '/group/:groupId/versions',
    requirePermission('quotation.read'),
    QuotationController.getGroupVersions,
);
router.get(
    '/:id',
    requirePermission('quotation.read'),
    QuotationController.getQuotationById,
);

router.post(
    '/',
    requirePermission('quotation.create'),
    QuotationController.createQuotation,
);
router.post(
    '/:id/send',
    requirePermission('quotation.create'),
    QuotationController.sendQuotation,
);
router.post(
    '/group/:groupId/version',
    requirePermission('quotation.create'),
    QuotationController.createNewVersion,
);

router.patch(
    '/:id',
    requirePermission('quotation.update'),
    QuotationController.updateQuotation,
);

router.delete(
    '/:id',
    requirePermission('quotation.delete'),
    QuotationController.deleteQuotation,
);

export const quotationRoute = router;
