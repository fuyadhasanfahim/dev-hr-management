import { Router } from 'express';
import InvitationController from '../controllers/invitation.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router: Router = Router();

// Admin-only routes (create, list, resend, cancel)
router.post(
    '/create',
    requirePermission('invitation.create'),
    InvitationController.createInvitation,
);

router.post(
    '/bulk',
    requirePermission('invitation.create'),
    InvitationController.createBulkInvitations,
);

router.get(
    '/',
    requirePermission('invitation.read'),
    InvitationController.getInvitations,
);

router.post(
    '/:id/resend',
    requirePermission('invitation.create'),
    InvitationController.resendInvitation,
);

router.delete(
    '/:id',
    requirePermission('invitation.delete'),
    InvitationController.cancelInvitation,
);

// Public routes (validate and accept)
router.get('/:token/validate', InvitationController.validateToken);

router.post('/:token/accept', InvitationController.acceptInvitation);

export const invitationRoute = router;
