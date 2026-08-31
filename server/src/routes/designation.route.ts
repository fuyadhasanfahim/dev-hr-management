import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { ScopePermissionsValidation } from '../validators/role.validation.js';
import DesignationControllers from '../controllers/designation.controller.js';
import GrantControllers from '../controllers/grant.controller.js';

const router: Router = Router();

router.get(
    '/',
    requirePermission('designation.read'),
    DesignationControllers.getAllDesignations,
);

router.get(
    '/:id',
    requirePermission('designation.read'),
    DesignationControllers.getDesignationById,
);

// Phase 6 — permission grant for everyone with this designation
router.patch(
    '/:id/permissions',
    requirePermission('role.assign'),
    validateRequest(ScopePermissionsValidation),
    GrantControllers.setDesignationPermissions,
);

router.post(
    '/',
    requirePermission('designation.manage'),
    DesignationControllers.createDesignation,
);

router.patch(
    '/:id',
    requirePermission('designation.manage'),
    DesignationControllers.updateDesignation,
);

router.patch(
    '/:id/toggle-status',
    requirePermission('designation.manage'),
    DesignationControllers.toggleDesignationStatus,
);

router.delete(
    '/:id',
    requirePermission('designation.manage'),
    DesignationControllers.deleteDesignation,
);

export const designationRoute = router;
