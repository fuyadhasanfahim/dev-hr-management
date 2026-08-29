import { Router } from "express";
import { requirePermission } from '../middlewares/require-permission.js';
import AttendanceController from "../controllers/attendance.controller.js";

const router: Router = Router();

router.post("/check-in", AttendanceController.checkIn);
router.post("/check-out", AttendanceController.checkOut);

router.get("/today", AttendanceController.getTodayAttendance);
router.get("/monthly-stats", AttendanceController.getMonthlyStats);
router.get("/my-history", AttendanceController.getMyAttendanceHistory);

// Admin routes
router.get(
    "/admin/all",
    requirePermission('attendance.read'),
    AttendanceController.getAllAttendance,
);

router.patch(
    "/admin/bulk-update",
    requirePermission('attendance.manage'),
    AttendanceController.bulkUpdateAttendanceStatus,
);

router.patch(
    "/admin/:id",
    requirePermission('attendance.manage'),
    AttendanceController.updateAttendanceStatus,
);

export const attendanceRoute = router;
