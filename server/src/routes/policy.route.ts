import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import {
    createPolicy,
    getPolicies,
    getPendingPolicies,
    acceptPolicy,
    togglePolicyStatus,
    deletePolicy,
    updatePolicy
} from '../controllers/policy.controller.js';

const router = Router();

// Routes for every authenticated user
router.get('/pending', getPendingPolicies);
router.post('/:id/accept', acceptPolicy);
router.get('/', getPolicies); // Open to all for role-based filtering in controller

// Routes for Admins/HR Managers
router.post('/', requirePermission('policy.manage'), createPolicy);
router.put('/:id', requirePermission('policy.manage'), updatePolicy);
router.patch('/:id/status', requirePermission('policy.manage'), togglePolicyStatus);
router.delete('/:id', requirePermission('policy.manage'), deletePolicy);

export { router as policyRoute };
