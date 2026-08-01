import { Router } from 'express';
import { QuotationTimelineController } from '../controllers/quotation-timeline.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

const TIMELINE_ADMIN_ROLES = [Role.SUPER_ADMIN, Role.ADMIN];

// ── Read ─────────────────────────────────────────────────────────────────────
router.get('/:quotationGroupId', authorize(...TIMELINE_ADMIN_ROLES), QuotationTimelineController.getTimeline);

// ── Admin actions ────────────────────────────────────────────────────────────
// NOTE (E5-F1-T2): these enqueue an OutboxEvent, but no consumer currently
// processes the Outbox queue anywhere in this codebase — see E5-F1-T2. Today
// these return 202 Accepted and log the request; they do not yet cause any
// downstream effect. Wiring them up now is still correct (the enqueue call
// itself is harmless and consistent with the rest of the system's current
// behavior), but do not present these as fully functional until E5-F1-T2
// ships a consumer.
router.post('/:quotationGroupId/replay', authorize(...TIMELINE_ADMIN_ROLES), QuotationTimelineController.requestReplay);
router.post(
    '/:quotationGroupId/regenerate-link',
    authorize(...TIMELINE_ADMIN_ROLES),
    QuotationTimelineController.requestRegenerateLink,
);

export const quotationTimelineRoute = router;
