import { Router } from "express";
import { requirePermission } from '../middlewares/require-permission.js';
import {
    applyForLeave,
    getAllLeaveApplications,
    getPendingLeaves,
    getMyLeaveApplications,
    getLeaveApplicationById,
    getLeaveBalance,
    approveLeave,
    rejectLeave,
    revokeLeave,
    cancelLeaveApplication,
    calculateWorkingDays,
    uploadMedicalDocument,
} from "../controllers/leave.controller.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();


// Staff routes — any authenticated user can apply for leave and view their own
router.post("/", requirePermission('leave.apply'), applyForLeave);
router.get("/my", requirePermission('leave.read'), getMyLeaveApplications);
router.get("/balance", requirePermission('leave.read'), getLeaveBalance);
router.get("/balance/:staffId", requirePermission('leave.read'), getLeaveBalance);
router.get("/calculate-days", requirePermission('leave.read'), calculateWorkingDays);
router.patch("/:id/cancel", requirePermission('leave.apply'), cancelLeaveApplication);
router.post(
    "/:id/upload-document",
    requirePermission('leave.apply'),
    upload.single("document"),
    uploadMedicalDocument,
);

// Admin routes — only managers and admins can approve/reject/revoke
router.get("/", requirePermission('leave.manage'), getAllLeaveApplications);
router.get("/pending", requirePermission('leave.manage'), getPendingLeaves);
router.get("/:id", requirePermission('leave.manage'), getLeaveApplicationById);
router.patch("/:id/approve", requirePermission('leave.approve'), approveLeave);
router.patch("/:id/reject", requirePermission('leave.approve'), rejectLeave);
router.patch("/:id/revoke", requirePermission('leave.approve'), revokeLeave);

export { router as leaveRoute };
