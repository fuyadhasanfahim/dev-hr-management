import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import BranchControllers from '../controllers/branch.controller.js';

const router: Router = Router();

router.get('/', requirePermission('branch.read'), BranchControllers.getAllBranches);

router.get('/:id', requirePermission('branch.read'), BranchControllers.getBranchById);

router.post(
    '/',
    requirePermission('branch.manage'),
    BranchControllers.createBranch,
);

router.patch(
    '/:id',
    requirePermission('branch.manage'),
    BranchControllers.updateBranch,
);

router.patch(
    '/:id/toggle-status',
    requirePermission('branch.manage'),
    BranchControllers.toggleBranchStatus,
);

router.delete(
    '/:id',
    requirePermission('branch.manage'),
    BranchControllers.deleteBranch,
);

export const branchRoute = router;
