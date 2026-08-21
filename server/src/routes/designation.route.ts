import { Router } from 'express';
import { Role } from '../constants/role.js';
import { authorize } from '../middlewares/authorize.js';
import DesignationControllers from '../controllers/designation.controller.js';

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
    DesignationControllers.getAllDesignations,
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
    DesignationControllers.getDesignationById,
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
