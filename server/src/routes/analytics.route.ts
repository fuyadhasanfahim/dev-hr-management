import { Router } from "express";
import analyticsController from "../controllers/analytics.controller.js";
import { requirePermission } from '../middlewares/require-permission.js';

const router = Router();

// GET /api/analytics/finance/years - Get available years for analytics
router.get(
    "/finance/years",
    requirePermission('analytics.read'),
    analyticsController.getAnalyticsYears,
);

// GET /api/analytics/finance - Get finance analytics
router.get(
    "/finance",
    requirePermission('analytics.read'),
    analyticsController.getFinanceAnalytics,
);

export const analyticsRoute = router;
