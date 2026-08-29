import { Router } from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import {
    getRatesForMonth,
    updateRatesForMonth,
} from '../controllers/currency-rate.controller.js';

const currencyRateRoute: Router = Router();

// Get rates for a specific month/year (any authenticated user)
currencyRateRoute.get('/:month/:year', getRatesForMonth);

// Update rates for a specific month/year (super_admin only)
currencyRateRoute.put(
    '/:month/:year',
    requirePermission('currencyRate.manage'),
    updateRatesForMonth
);

export { currencyRateRoute };
