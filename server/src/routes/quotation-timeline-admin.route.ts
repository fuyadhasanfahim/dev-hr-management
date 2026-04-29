import { Router } from 'express';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';
import { QuotationTimelineController } from '../controllers/quotation-timeline.controller.js';

const router: Router = Router();

router.get(
    '/:quotationGroupId',
    authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER),
    QuotationTimelineController.getTimeline,
);

router.post(
    '/:quotationGroupId/replay',
    authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER),
    QuotationTimelineController.requestReplay,
);

router.post(
    '/:quotationGroupId/regenerate-link',
    authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER),
    QuotationTimelineController.requestRegenerateLink,
);

export const quotationTimelineAdminRoute = router;

