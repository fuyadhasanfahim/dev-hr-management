import { Router } from 'express';
import ShiftOffDateController from '../controllers/shift-off-date.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router = Router();

// Get my shift's off dates (for staff)
router.get('/my-off-dates', ShiftOffDateController.getMyShiftOffDates);

// Get off dates for a specific shift
router.get(
    '/:shiftId/off-dates',
    requirePermission('shift.read'),
    ShiftOffDateController.getOffDates,
);

// Add off dates to a shift
router.put(
    '/:shiftId/off-dates',
    requirePermission('shift.update'),
    ShiftOffDateController.addOffDates,
);

// Remove off dates from a shift
router.delete(
    '/:shiftId/off-dates',
    requirePermission('shift.update'),
    ShiftOffDateController.removeOffDates,
);

export default router;
