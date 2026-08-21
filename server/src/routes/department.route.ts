import { Router } from 'express';
import { Role } from '../constants/role.js';
import { authorize } from '../middlewares/authorize.js';
import DepartmentControllers from '../controllers/department.controller.js';

const router: Router = Router();

router.get('/', DepartmentControllers.getAllDepartments);

router.get('/:id', DepartmentControllers.getDepartmentById);

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
