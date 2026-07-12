import { Router } from "express";
import {
    getAllEarnings,
    getEarningById,
    getEarningStats,
    getEarningYears,
} from "../controllers/earning.controller.js";
import { authorize } from "../middlewares/authorize.js";
import { Role } from "../constants/role.js";

const router = Router();

const allowedRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.HR_MANAGER];

// Earnings are read-only — they're fully derived from Receipt payments
// (see ReceiptService.addPayment/voidPayment -> EarningService.syncEarningFromReceipt).
router.get("/", authorize(...allowedRoles), getAllEarnings);
router.get("/stats", authorize(...allowedRoles), getEarningStats);
router.get("/years", authorize(...allowedRoles), getEarningYears);
router.get("/:id", authorize(...allowedRoles), getEarningById);

export { router as earningRoute };
