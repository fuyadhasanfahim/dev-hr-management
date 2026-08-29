import { Router } from 'express';
import { PayrollBankSettingsController } from '../controllers/payroll-bank-settings.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router = Router();

// All routes require authorization
router.get(
    '/',
    requirePermission('payroll.bankSettings'),
    PayrollBankSettingsController.getAllBankSettings,
);
router.get(
    '/:id',
    requirePermission('payroll.bankSettings'),
    PayrollBankSettingsController.getBankSettingById,
);
router.post(
    '/',
    requirePermission('payroll.bankSettings'),
    PayrollBankSettingsController.createBankSetting,
);
router.put(
    '/:id',
    requirePermission('payroll.bankSettings'),
    PayrollBankSettingsController.updateBankSetting,
);
router.delete(
    '/:id',
    requirePermission('payroll.bankSettings'),
    PayrollBankSettingsController.deleteBankSetting,
);

export default router;
