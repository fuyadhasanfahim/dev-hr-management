import { Router } from 'express';
import { Role } from '../constants/role.js';
import { authorize } from '../middlewares/authorize.js';
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
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    DepartmentControllers.createDepartment,
);

router.patch(
    '/:id',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    DepartmentControllers.updateDepartment,
);

router.patch(
    '/:id/toggle-status',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    DepartmentControllers.toggleDepartmentStatus,
);

router.delete(
    '/:id',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    DepartmentControllers.deleteDepartment,
);

export const departmentRoute = router;
