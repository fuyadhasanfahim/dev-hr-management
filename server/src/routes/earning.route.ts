import { Router } from "express";
import { requirePermission } from '../middlewares/require-permission.js';
import {
    getAllEarnings,
    getEarningById,
    getEarningStats,
    getEarningYears,
} from "../controllers/earning.controller.js";

const router = Router();

// Earnings are read-only — they're fully derived from Receipt payments
// (see ReceiptService.addPayment/voidPayment -> EarningService.syncEarningFromReceipt).
router.get("/", requirePermission('earning.read'), getAllEarnings);
router.get("/stats", requirePermission('earning.read'), getEarningStats);
router.get("/years", requirePermission('earning.read'), getEarningYears);
router.get("/:id", requirePermission('earning.read'), getEarningById);

export { router as earningRoute };
