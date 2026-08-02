import { Router } from 'express';
import { QuotationTimelineController } from '../controllers/quotation-timeline.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

const TIMELINE_ADMIN_ROLES = [Role.SUPER_ADMIN, Role.ADMIN];

// ── Read ─────────────────────────────────────────────────────────────────────
router.get('/:quotationGroupId', authorize(...TIMELINE_ADMIN_ROLES), QuotationTimelineController.getTimeline);

// ── Admin actions ────────────────────────────────────────────────────────────
// NOTE (E5-F1-T2): `replay` executes synchronously (direct
// OutboxService.replayMany call — the "admin.outbox.replay" Outbox event
// was removed, see quotation-timeline.controller.ts). `regenerate-link`
// still enqueues an `admin.quotation.regenerate_link` Outbox event and
// returns 202 Accepted — the Outbox worker (outbox-worker.service.ts) now
// has a real handler for it, reusing QuotationService.sendQuotation().
router.post('/:quotationGroupId/replay', authorize(...TIMELINE_ADMIN_ROLES), QuotationTimelineController.requestReplay);
router.post(
    '/:quotationGroupId/regenerate-link',
    authorize(...TIMELINE_ADMIN_ROLES),
    QuotationTimelineController.requestRegenerateLink,
);

export const quotationTimelineRoute = router;
