import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import Ctrl from '../controllers/payment-reminder.controller.js';

const router: Router = Router();

router.get('/', requirePermission('paymentReminder.read'), Ctrl.list);
router.get('/pending', requirePermission('paymentReminder.manage'), Ctrl.pending);
router.post('/prompted', requirePermission('paymentReminder.manage'), Ctrl.prompted);
router.post('/schedule', requirePermission('paymentReminder.manage'), Ctrl.scheduleMany);
router.post('/sync', requirePermission('paymentReminder.manage'), Ctrl.sync);
router.patch('/:id/schedule', requirePermission('paymentReminder.manage'), Ctrl.reschedule);
router.post('/:id/:action', requirePermission('paymentReminder.manage'), Ctrl.action);

export const paymentReminderRoute = router;
