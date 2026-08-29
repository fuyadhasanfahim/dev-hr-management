import { Router } from 'express';
import OutboxController from '../controllers/outbox.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router: Router = Router();

// ── List & detail ────────────────────────────────────────────────────────────
router.get('/', requirePermission('outbox.read'), OutboxController.listOutbox);
router.get('/:id', requirePermission('outbox.read'), OutboxController.getOutboxById);

// ── Replay (recover a dead-lettered/failed event) ───────────────────────────
router.post('/replay', requirePermission('outbox.replay'), OutboxController.replayOutboxMany);
router.post('/:id/replay', requirePermission('outbox.replay'), OutboxController.replayOutboxById);

export const outboxRoute = router;
