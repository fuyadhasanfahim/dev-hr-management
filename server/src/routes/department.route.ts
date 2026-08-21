import { Router } from 'express';
import { Role } from '../constants/role.js';
import { authorize } from '../middlewares/authorize.js';
import DepartmentControllers from '../controllers/department.controller.js';

const router: Router = Router();

router.get(
    '/',
    authorize(
        Role.ADMIN,
        Role.SUPER_ADMIN,
        Role.HR_MANAGER,
        Role.TEAM_LEADER,
        Role.STAFF,
    ),
    DepartmentControllers.getAllDepartments,
);

router.get(
    '/:id',
    authorize(
        Role.ADMIN,
        Role.SUPER_ADMIN,
        Role.HR_MANAGER,
        Role.TEAM_LEADER,
        Role.STAFF,
    ),
    DepartmentControllers.getDepartmentById,
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
