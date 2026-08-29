import { Router } from "express";
import ExpenseController from "../controllers/expense.controller.js";
import { requirePermission } from '../middlewares/require-permission.js';

const router: Router = Router();

// Expense routes (static paths first)
router.get(
    "/",
    requirePermission('expense.read'),
    ExpenseController.getAllExpenses,
);
router.get(
    "/stats",
    requirePermission('expense.read'),
    ExpenseController.getExpenseStats,
);
router.post("/", requirePermission('expense.create'), ExpenseController.createExpense);

// Category routes (must be before /:id to avoid matching 'categories' as an id)
router.get(
    "/categories",
    requirePermission('expense.read'),
    ExpenseController.getAllCategories,
);
router.post(
    "/categories",
    requirePermission('expense.create'),
    ExpenseController.createCategory,
);
router.patch(
    "/categories/:id",
    requirePermission('expense.update'),
    ExpenseController.updateCategory,
);
router.delete(
    "/categories/:id",
    requirePermission('expense.delete'),
    ExpenseController.deleteCategory,
);

router.get("/years", ExpenseController.getExpenseYears);

// Expense routes with :id parameter (last, to catch remaining)
router.get(
    "/:id",
    requirePermission('expense.read'),
    ExpenseController.getExpenseById,
);
router.patch(
    "/:id",
    requirePermission('expense.update'),
    ExpenseController.updateExpense,
);
router.delete(
    "/:id",
    requirePermission('expense.delete'),
    ExpenseController.deleteExpense,
);

export const expenseRoute = router;
