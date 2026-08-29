import { Router } from 'express';
import { QuotationTimelineController } from '../controllers/quotation-timeline.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router: Router = Router();

// ── Read ─────────────────────────────────────────────────────────────────────
router.get('/:quotationGroupId', requirePermission('quotation.read'), QuotationTimelineController.getTimeline);

// ── Admin actions ────────────────────────────────────────────────────────────
// NOTE (E5-F1-T2): `replay` executes synchronously (direct
// OutboxService.replayMany call — the "admin.outbox.replay" Outbox event
// was removed, see quotation-timeline.controller.ts). `regenerate-link`
// still enqueues an `admin.quotation.regenerate_link` Outbox event and
// returns 202 Accepted — the Outbox worker (outbox-worker.service.ts) now
// has a real handler for it, reusing QuotationService.sendQuotation().
router.post('/:quotationGroupId/replay', requirePermission('quotation.update'), QuotationTimelineController.requestReplay);
router.post(
    '/:quotationGroupId/regenerate-link',
    requirePermission('quotation.update'),
    QuotationTimelineController.requestRegenerateLink,
);

export const quotationTimelineRoute = router;
