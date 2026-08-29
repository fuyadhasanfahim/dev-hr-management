import { Router } from "express";
import { requirePermission } from '../middlewares/require-permission.js';
import payrollController from "../controllers/payroll.controller.js";
import {
    validate,
    payrollPreviewSchema,
    processPaymentSchema,
    bulkProcessSchema,
    graceSchema,
    absentDatesSchema,
    undoPaymentSchema,
    lockMonthSchema,
} from "../validators/payroll.validator.js";

const router: Router = Router();

const readAccess = requirePermission('payroll.read');
const writeAccess = requirePermission('payroll.process');

// Preview
router.get(
    "/preview",
    readAccess,
    validate(payrollPreviewSchema, "query"),
    payrollController.getPayrollPreview,
);

// Payments
router.post(
    "/process",
    writeAccess,
    validate(processPaymentSchema),
    payrollController.processPayment,
);
router.post(
    "/bulk-process",
    writeAccess,
    validate(bulkProcessSchema),
    payrollController.bulkProcessPayment,
);

// Grace attendance
router.post(
    "/grace",
    writeAccess,
    validate(graceSchema),
    payrollController.graceAttendance,
);

// Absent dates
router.get(
    "/absent-dates",
    readAccess,
    validate(absentDatesSchema, "query"),
    payrollController.getAbsentDates,
);

// Undo
router.post(
    "/undo",
    writeAccess,
    validate(undoPaymentSchema),
    payrollController.undoPayment,
);

// Payroll Lock
router.get("/lock-status", readAccess, payrollController.getLockStatus);
router.post(
    "/lock",
    requirePermission('payroll.lock'),
    validate(lockMonthSchema),
    payrollController.lockMonth,
);
router.post(
    "/unlock",
    requirePermission('payroll.lock'),
    validate(lockMonthSchema),
    payrollController.unlockMonth,
);

// Set attendance from calendar
router.post(
    "/set-attendance",
    writeAccess,
    payrollController.setAttendance,
);

export const payrollRoute = router;
