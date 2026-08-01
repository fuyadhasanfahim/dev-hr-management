import { Router } from 'express';
import OutboxController from '../controllers/outbox.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router: Router = Router();

const OUTBOX_ADMIN_ROLES = [Role.SUPER_ADMIN, Role.ADMIN];

// ── List & detail ────────────────────────────────────────────────────────────
router.get('/', authorize(...OUTBOX_ADMIN_ROLES), OutboxController.listOutbox);
router.get('/:id', authorize(...OUTBOX_ADMIN_ROLES), OutboxController.getOutboxById);

// ── Replay (recover a dead-lettered/failed event) ───────────────────────────
router.post('/replay', authorize(...OUTBOX_ADMIN_ROLES), OutboxController.replayOutboxMany);
router.post('/:id/replay', authorize(...OUTBOX_ADMIN_ROLES), OutboxController.replayOutboxById);

export const outboxRoute = router;
