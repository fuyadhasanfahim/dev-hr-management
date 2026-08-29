import { Router } from 'express';
import RoleControllers from '../controllers/role.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router: Router = Router();

// `requireAuth` already ran on the /api gate (app.ts); these only add the
// permission check. All read-only in Phase 3 — mutations arrive in Phase 5.

router.get('/', requirePermission('role.read'), RoleControllers.listRoles);

router.get(
    '/catalog',
    requirePermission('role.read'),
    RoleControllers.getPermissionCatalog,
);

router.get('/:slug', requirePermission('role.read'), RoleControllers.getRole);

export const roleRoute = router;
