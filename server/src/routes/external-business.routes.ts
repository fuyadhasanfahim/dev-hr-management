import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import {
    createBusiness,
    getAllBusinesses,
    getBusinessById,
    updateBusiness,
    deleteBusiness,
    transferProfit,
    getTransfers,
    getTransferStats,
    deleteTransfer,
} from '../controllers/external-business.controller.js';

const router = Router();

const canRead = requirePermission('externalBusiness.read');
const canManage = requirePermission('externalBusiness.manage');

// Business routes
router.post('/businesses', canManage, createBusiness);
router.get('/businesses', canRead, getAllBusinesses);
router.get('/businesses/:id', canRead, getBusinessById);
router.put('/businesses/:id', canManage, updateBusiness);
router.delete('/businesses/:id', canManage, deleteBusiness);

// Transfer routes
router.post('/transfers', canManage, transferProfit);
router.get('/transfers', canRead, getTransfers);
router.get('/transfers/stats', canRead, getTransferStats);
router.delete('/transfers/:id', canManage, deleteTransfer);

export default router;
