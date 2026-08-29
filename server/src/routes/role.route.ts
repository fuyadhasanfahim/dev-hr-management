import { Router } from 'express';
import RoleControllers from '../controllers/role.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
    AssignUserAccessValidation,
    CreateRoleValidation,
    UpdateRoleValidation,
} from '../validators/role.validation.js';

const router: Router = Router();

// `requireAuth` already ran on the /api gate (app.ts); these add the
// permission check on top.
//
//   role.read   — view roles + the permission catalog
//   role.manage — create / edit / delete roles
//   role.assign — set a user's role + per-user permission overrides

router.get('/', requirePermission('role.read'), RoleControllers.listRoles);

router.get(
    '/catalog',
    requirePermission('role.read'),
    RoleControllers.getPermissionCatalog,
);

router.post(
    '/',
    requirePermission('role.manage'),
    validateRequest(CreateRoleValidation),
    RoleControllers.createRole,
);

router.put(
    '/users/:userId/access',
    requirePermission('role.assign'),
    validateRequest(AssignUserAccessValidation),
    RoleControllers.assignUserAccess,
);

router.get('/:slug', requirePermission('role.read'), RoleControllers.getRole);

router.patch(
    '/:slug',
    requirePermission('role.manage'),
    validateRequest(UpdateRoleValidation),
    RoleControllers.updateRole,
);

router.delete(
    '/:slug',
    requirePermission('role.manage'),
    RoleControllers.deleteRole,
);

export const roleRoute = router;
