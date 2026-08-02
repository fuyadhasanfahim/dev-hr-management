/**
 * Integration-style tests for E1-F2-T2: `processPayroll`'s amount-mismatch
 * confirmation gate.
 *
 * The pure decision logic (`resolvePayrollAmountConfirmation`) is unit
 * tested directly in `payroll-calculation.util.test.ts`. This file instead
 * exercises `processPayroll` itself, end to end, to prove the actual
 * safety property the task requires: an out-of-tolerance, unconfirmed
 * mismatch throws `PayrollAmountMismatchError` and — critically —
 * `mongoose.startSession()` is never called for that path, so no Mongo
 * session/transaction is ever opened and no write is possible. The
 * in-tolerance and confirmed-mismatch paths are also exercised end to end
 * through a fully mocked write chain, proving they still reach a
 * successful result.
 *
 * Every Mongoose model/service `processPayroll` touches is monkey-patched
 * per test (same approach as `receipt-zero-payment-race.test.ts` for
 * E1-F3-T1) — no live MongoDB connection needed. Fixtures use empty
 * shift-assignment/attendance arrays so `computeWorkDayStats` resolves to
 * zero work days, making `expectedAmount` simply `staffSalary + bonus -
 * deduction` — deterministic and easy to reason about without needing
 * real calendar/shift data.
 *
 * Run with: node --import tsx --test src/services/__tests__/payroll-amount-mismatch.test.ts
 * (run from the `server/` directory)
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import payrollService, { PayrollAmountMismatchError } from '../payroll.service.js';
import StaffModel from '../../models/staff.model.js';
import AttendanceDayModel from '../../models/attendance-day.model.js';
import ShiftAssignmentModel from '../../models/shift-assignment.model.js';
import ExpenseModel from '../../models/expense.model.js';
import ExpenseCategoryModel from '../../models/expense-category.model.js';
import { PayrollLockModel } from '../../models/payroll-lock.model.js';
import SalaryAdjustmentLogModel from '../../models/salary-adjustment-log.model.js';
import ShiftOffDateModel from '../../models/shift-off-date.model.js';
import auditService from '../audit.service.js';
import analyticsService from '../analytics.service.js';

const STAFF_ID = '507f1f77bcf86cd799439011';
const STAFF_SALARY = 30000;

function chain(resolvedValue: unknown) {
    // Supports whichever single chained method a given call site uses
    // (.session(), .populate(), .lean()) — each real call site here only
    // ever chains one, so a shared shape is simplest and safe.
    return {
        session: () => Promise.resolve(resolvedValue),
        populate: () => Promise.resolve(resolvedValue),
        lean: () => Promise.resolve(resolvedValue),
    };
}

function createFakeSession() {
    return {
        startTransaction: () => {},
        commitTransaction: async () => {},
        abortTransaction: async () => {},
        endSession: () => {},
    };
}

describe('processPayroll — amount mismatch confirmation gate (E1-F2-T2)', () => {
    let originals: Record<string, unknown>;
    let startSessionCalls: number;

    beforeEach(() => {
        startSessionCalls = 0;

        originals = {
            payrollLockFindOne: PayrollLockModel.findOne,
            staffFindById: StaffModel.findById,
            shiftAssignmentFind: ShiftAssignmentModel.find,
            attendanceFind: AttendanceDayModel.find,
            shiftOffDateFind: ShiftOffDateModel.find,
            mongooseStartSession: mongoose.startSession,
            expenseCategoryFindOne: ExpenseCategoryModel.findOne,
            expenseFindOne: ExpenseModel.findOne,
            expenseCreate: ExpenseModel.create,
            salaryLogFindOne: SalaryAdjustmentLogModel.findOne,
            salaryLogCreate: SalaryAdjustmentLogModel.create,
            getCurrentFinalAmount: analyticsService.getCurrentFinalAmount,
            createLog: auditService.createLog,
        };

        // ── Reads that run before the mismatch decision (every scenario) ──
        (PayrollLockModel as any).findOne = async () => null;
        (StaffModel as any).findById = async () => ({
            _id: STAFF_ID,
            salary: STAFF_SALARY,
            branchId: 'branch-1',
            joinDate: undefined,
            exitDate: undefined,
        });
        (ShiftAssignmentModel as any).find = () => chain([]);
        (AttendanceDayModel as any).find = async () => [];
        (ShiftOffDateModel as any).find = () => chain([]);

        // ── Session spy: the "no writes before confirmation" proof ──
        (mongoose as any).startSession = async () => {
            startSessionCalls++;
            return createFakeSession();
        };

        // ── Write-chain mocks, only exercised on the success paths ──
        (ExpenseCategoryModel as any).findOne = () => chain({ _id: 'cat-1' });
        (ExpenseModel as any).findOne = () => chain(null);
        (ExpenseModel as any).create = async (docs: any[]) => [{ _id: 'expense-1', ...docs[0] }];
        (SalaryAdjustmentLogModel as any).findOne = () => chain(null);
        (SalaryAdjustmentLogModel as any).create = async () => [{ _id: 'log-1' }];
        (analyticsService as any).getCurrentFinalAmount = async () => 10_000_000;
        (auditService as any).createLog = async () => undefined;
    });

    afterEach(() => {
        (PayrollLockModel as any).findOne = originals.payrollLockFindOne;
        (StaffModel as any).findById = originals.staffFindById;
        (ShiftAssignmentModel as any).find = originals.shiftAssignmentFind;
        (AttendanceDayModel as any).find = originals.attendanceFind;
        (ShiftOffDateModel as any).find = originals.shiftOffDateFind;
        (mongoose as any).startSession = originals.mongooseStartSession;
        (ExpenseCategoryModel as any).findOne = originals.expenseCategoryFindOne;
        (ExpenseModel as any).findOne = originals.expenseFindOne;
        (ExpenseModel as any).create = originals.expenseCreate;
        (SalaryAdjustmentLogModel as any).findOne = originals.salaryLogFindOne;
        (SalaryAdjustmentLogModel as any).create = originals.salaryLogCreate;
        (analyticsService as any).getCurrentFinalAmount = originals.getCurrentFinalAmount;
        (auditService as any).createLog = originals.createLog;
    });

    test('difference = 0: succeeds, bonus/deduction untouched, session opened normally', async () => {
        const result = await payrollService.processPayroll({
            staffId: STAFF_ID,
            month: '2026-06',
            amount: STAFF_SALARY, // expectedAmount === STAFF_SALARY with empty assignments/attendance
            paymentMethod: 'cash',
            bonus: 0,
            deduction: 0,
            createdBy: '507f191e810c19729de860ea',
        });

        assert.equal((result as any)._id, 'expense-1');
        assert.equal(startSessionCalls, 1, 'in-tolerance path must proceed to open a session');
    });

    test('difference = 2 (at tolerance boundary): succeeds unchanged, not treated as a mismatch', async () => {
        const result = await payrollService.processPayroll({
            staffId: STAFF_ID,
            month: '2026-06',
            amount: STAFF_SALARY + 2,
            paymentMethod: 'cash',
            bonus: 0,
            deduction: 0,
            createdBy: '507f191e810c19729de860ea',
        });

        assert.equal((result as any)._id, 'expense-1');
        assert.equal(startSessionCalls, 1);
    });

    test('difference > 2 without confirm: rejects with PayrollAmountMismatchError, never opens a session (no writes possible)', async () => {
        await assert.rejects(
            () =>
                payrollService.processPayroll({
                    staffId: STAFF_ID,
                    month: '2026-06',
                    amount: STAFF_SALARY + 50,
                    paymentMethod: 'cash',
                    bonus: 0,
                    deduction: 0,
                    createdBy: '507f191e810c19729de860ea',
                }),
            (err: unknown) => {
                assert.ok(err instanceof PayrollAmountMismatchError);
                assert.equal(err.code, 'PAYROLL_AMOUNT_MISMATCH');
                assert.equal(err.expectedAmount, STAFF_SALARY);
                assert.equal(err.receivedAmount, STAFF_SALARY + 50);
                assert.equal(err.difference, 50);
                return true;
            },
        );

        assert.equal(startSessionCalls, 0, 'an unconfirmed mismatch must never open a Mongo session — no writes can occur');
    });

    test('difference > 2 with confirm=true: succeeds, folds the difference into bonus, session opened', async () => {
        const result = await payrollService.processPayroll({
            staffId: STAFF_ID,
            month: '2026-06',
            amount: STAFF_SALARY + 50,
            paymentMethod: 'cash',
            bonus: 0,
            deduction: 0,
            createdBy: '507f191e810c19729de860ea',
            confirm: true,
        });

        assert.equal((result as any)._id, 'expense-1');
        assert.equal(startSessionCalls, 1, 'a confirmed mismatch must proceed to open a session and process normally');
        // The fold happens inside processPayroll's local bonus/deduction,
        // which flow into the expense note — confirm indirectly via the
        // note text rather than reaching into private state.
        assert.match((result as any).note ?? '', /Bonus: 50/);
    });

    test('difference < -2 with confirm=true: succeeds, folds the difference into deduction', async () => {
        const result = await payrollService.processPayroll({
            staffId: STAFF_ID,
            month: '2026-06',
            amount: STAFF_SALARY - 50,
            paymentMethod: 'cash',
            bonus: 0,
            deduction: 0,
            createdBy: '507f191e810c19729de860ea',
            confirm: true,
        });

        assert.equal((result as any)._id, 'expense-1');
        assert.equal(startSessionCalls, 1);
        assert.match((result as any).note ?? '', /Deduction: 50/);
    });

    test('non-salary paymentType: mismatch check does not apply, even with a huge amount difference', async () => {
        // paymentType is typed as the literal 'salary' at the call site,
        // but the runtime check in processPayroll is `paymentType ===
        // 'salary'` — cast to bypass the type-level literal restriction and
        // exercise the actual runtime branch, mirroring how the controller
        // forwards whatever the client actually sent.
        const result = await payrollService.processPayroll({
            staffId: STAFF_ID,
            month: '2026-06',
            amount: 999_999,
            paymentMethod: 'cash',
            bonus: 0,
            deduction: 0,
            createdBy: '507f191e810c19729de860ea',
            paymentType: 'bonus' as any,
        });

        assert.equal((result as any)._id, 'expense-1');
        assert.equal(startSessionCalls, 1, 'no amount verification applies outside paymentType "salary"');
    });
});
