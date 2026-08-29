import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import ShiftControllers from '../controllers/shift.controller.js';

const router: Router = Router();

router.get('/my-shift', ShiftControllers.getMyShift);

router.post(
    '/',
    requirePermission('shift.create'),
    ShiftControllers.createShift,
);

router.get(
    '/',
    requirePermission('shift.read'),
    ShiftControllers.getAllShifts,
);

router.patch(
    '/:id',
    requirePermission('shift.update'),
    ShiftControllers.updateShift,
);

router.delete(
    '/:id',
    requirePermission('shift.delete'),
    ShiftControllers.deleteShift,
);

export const shiftRoute = router;
