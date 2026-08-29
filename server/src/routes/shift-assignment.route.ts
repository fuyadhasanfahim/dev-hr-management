import { Router } from 'express';
import shiftAssignmentController from '../controllers/shift-assignment.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router: Router = Router();

router.post(
    '/assign',
    requirePermission('shift.assign'),
    shiftAssignmentController.assignShift,
);

export const ShiftAssignmentRoute: Router = router;
