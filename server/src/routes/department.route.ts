import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { ScopePermissionsValidation } from '../validators/role.validation.js';
import DepartmentControllers from '../controllers/department.controller.js';
import GrantControllers from '../controllers/grant.controller.js';

const router: Router = Router();

router.get('/', DepartmentControllers.getAllDepartments);

router.get('/:id', DepartmentControllers.getDepartmentById);

// Phase 6 — permission grant for everyone in this department
router.patch(
    '/:id/permissions',
    requirePermission('role.assign'),
    validateRequest(ScopePermissionsValidation),
    GrantControllers.setDepartmentPermissions,
);

router.post(
    '/',
    requirePermission('department.manage'),
    DepartmentControllers.createDepartment,
);

router.patch(
    '/:id',
    requirePermission('department.manage'),
    DepartmentControllers.updateDepartment,
);

router.patch(
    '/:id/toggle-status',
    requirePermission('department.manage'),
    DepartmentControllers.toggleDepartmentStatus,
);

router.delete(
    '/:id',
    requirePermission('department.manage'),
    DepartmentControllers.deleteDepartment,
);

export const departmentRoute = router;
