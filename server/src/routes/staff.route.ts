import { Router } from "express";
import StaffController from "../controllers/staff.controller.js";
import { requirePermission } from '../middlewares/require-permission.js';
import { 
    getMyTransactions, 
    getAllTransactions, 
    adminWithdraw 
} from "../controllers/wallet-transaction.controller.js";

const router: Router = Router();

// Intentionally only `requireAuth` (the /api gate), no `staff.read`: task /
// shift / leave assignment pickers need a staff list for team leaders and
// staff, who do not hold `staff.read`. Detail (`/:id`) stays gated.
router.get("/", StaffController.getStaffs);
router.get("/me", StaffController.getStaff);

// Wallet Transactions
router.get("/wallet-transactions/me", getMyTransactions);
router.get(
    "/wallet-transactions/all",
    requirePermission('wallet.manage'),
    getAllTransactions
);
router.post(
    "/wallet-transactions/withdraw",
    requirePermission('wallet.manage'),
    adminWithdraw
);

// `/export` must precede `/:id` or Express routes it to getStaffById with id="export".
router.get(
    "/export",
    requirePermission('staff.read'),
    StaffController.exportStaffs,
);
router.get(
    "/:id",
    requirePermission('staff.read'),
    StaffController.getStaffById,
);

router.post(
    "/create",
    requirePermission('staff.create'),
    StaffController.createStaff,
);

router.put("/complete-profile", StaffController.completeProfile);

router.put("/update-profile", StaffController.updateProfile);

router.post("/view-salary", StaffController.viewSalary);

router.put(
    "/:staffId/salary",
    requirePermission('staff.update'),
    StaffController.updateSalary,
);

router.patch(
    "/:staffId",
    requirePermission('staff.update'),
    StaffController.updateStaff,
);

// Set Salary PIN
router.post(
    "/:staffId/pin/set",
    // Self-service: any authenticated user; the controller restricts writes
    // to the caller's own staff record (changedBy).
    StaffController.setSalaryPin,
);

// Verify Salary PIN
router.post(
    "/:staffId/pin/verify",
    StaffController.verifySalaryPin,
);

// Forgot/Reset PIN
router.post("/pin/forgot", StaffController.forgotSalaryPin);
router.post("/pin/reset", StaffController.resetSalaryPin);

export const staffRoute = router;
