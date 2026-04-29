import { Router } from 'express';
import OutboxController from '../controllers/outbox.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

router.get(
    '/',
    authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER),
    OutboxController.listOutbox,
);

router.get(
    '/:id',
    authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER),
    OutboxController.getOutboxById,
);

router.post(
    '/replay',
    authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER),
    OutboxController.replayOutboxMany,
);

router.post(
    '/:id/replay',
    authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER),
    OutboxController.replayOutboxById,
);

export const outboxAdminRoute = router;

