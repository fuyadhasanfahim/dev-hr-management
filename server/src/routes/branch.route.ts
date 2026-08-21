import { Router } from 'express';
import { Role } from '../constants/role.js';
import { authorize } from '../middlewares/authorize.js';
import BranchControllers from '../controllers/branch.controller.js';

const router: Router = Router();

router.get('/', BranchControllers.getAllBranches);

router.get('/:id', BranchControllers.getBranchById);

router.post(
    '/',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    BranchControllers.createBranch,
);

router.patch(
    '/:id',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    BranchControllers.updateBranch,
);

router.patch(
    '/:id/toggle-status',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    BranchControllers.toggleBranchStatus,
);

router.delete(
    '/:id',
    authorize(Role.ADMIN, Role.SUPER_ADMIN, Role.HR_MANAGER),
    BranchControllers.deleteBranch,
);

export const branchRoute = router;
