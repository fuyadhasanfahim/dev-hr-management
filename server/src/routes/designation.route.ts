import { Router } from 'express';
import { Role } from '../constants/role.js';
import { authorize } from '../middlewares/authorize.js';
import { requirePermission } from '../middlewares/require-permission.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { ScopePermissionsValidation } from '../validators/role.validation.js';
import DesignationControllers from '../controllers/designation.controller.js';
import GrantControllers from '../controllers/grant.controller.js';

const router: Router = Router();

router.get('/', DesignationControllers.getAllDesignations);

router.get('/:id', DesignationControllers.getDesignationById);

// Phase 6 — permission grant for everyone with this designation
router.patch(
    '/:id/permissions',
    requirePermission('role.assign'),
    validateRequest(ScopePermissionsValidation),
    GrantControllers.setDesignationPermissions,
);

router.post(
    '/',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    DesignationControllers.createDesignation,
);

router.patch(
    '/:id',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    DesignationControllers.updateDesignation,
);

router.patch(
    '/:id/toggle-status',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    DesignationControllers.toggleDesignationStatus,
);

router.delete(
    '/:id',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    DesignationControllers.deleteDesignation,
);

export const designationRoute = router;
