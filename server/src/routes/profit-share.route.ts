import { Router } from "express";
import { requirePermission } from '../middlewares/require-permission.js';
import {
    createShareholder,
    getAllShareholders,
    getShareholderById,
    updateShareholder,
    deleteShareholder,
    getProfitSummary,
    distributeProfit,
    getDistributions,
} from "../controllers/profit-share.controller.js";

const router = Router();

// Shareholder routes
router.post("/shareholders", requirePermission('profitShare.manage'), createShareholder);
router.get("/shareholders", requirePermission('profitShare.read'), getAllShareholders);
router.get("/shareholders/:id", requirePermission('profitShare.read'), getShareholderById);
router.put("/shareholders/:id", requirePermission('profitShare.manage'), updateShareholder);
router.delete(
    "/shareholders/:id",
    requirePermission('profitShare.manage'),
    deleteShareholder,
);

// Profit summary
router.get("/summary", requirePermission('profitShare.read'), getProfitSummary);

// Distribution routes
router.post("/distribute", requirePermission('profitShare.manage'), distributeProfit);
router.get("/distributions", requirePermission('profitShare.read'), getDistributions);

export const profitShareRoute = router;
