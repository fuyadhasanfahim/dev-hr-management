import { Router } from 'express';
import DashboardController from '../controllers/dashboard.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router: Router = Router();

// Admin dashboard - Only for Admin, HR Manager, and Super Admin
router.get(
    '/admin',
    requirePermission('dashboard.read'),
    DashboardController.getAdminDashboard,
);

export const dashboardRoute = router;
