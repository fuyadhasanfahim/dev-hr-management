/**
 * Unit tests for E1-F2-T2: `processPayment`'s controller-level mapping of
 * `PayrollAmountMismatchError` to the agreed `409` response contract, and a
 * regression check that the pre-existing "locked" (400) / generic (500)
 * error mapping is unaffected.
 *
 * `payrollService.processPayroll` is monkey-patched per test (same pattern
 * as `quotation-timeline-controller.test.ts` for E5-F1-T2 Phase 1b) — no
 * live MongoDB connection needed.
 *
 * Run with: node --import tsx --test src/controllers/__tests__/payroll-controller.test.ts
 * (run from the `server/` directory)
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import payrollController from '../payroll.controller.js';
import payrollService, { PayrollAmountMismatchError } from '../../services/payroll.service.js';

function fakeReqRes(body: Record<string, unknown>) {
    const req = {
        body,
        user: { id: '507f191e810c19729de860ea' },
        ip: '127.0.0.1',
        headers: {},
    } as unknown as Request;

    let statusCode: number | undefined;
    let jsonBody: unknown;
    const res = {
        status(code: number) {
            statusCode = code;
            return this;
        },
        json(payload: unknown) {
            jsonBody = payload;
            return this;
        },
    } as unknown as Response;

    return { req, res, getStatus: () => statusCode, getJson: () => jsonBody };
}

describe('processPayment — amount mismatch → 409 (E1-F2-T2)', () => {
    let originalProcessPayroll: typeof payrollService.processPayroll;

    beforeEach(() => {
        originalProcessPayroll = payrollService.processPayroll;
    });

    afterEach(() => {
        payrollService.processPayroll = originalProcessPayroll;
    });

    test('PayrollAmountMismatchError maps to 409 with the agreed contract shape', async () => {
        let calledWith: any;
        (payrollService as any).processPayroll = async (params: any) => {
            calledWith = params;
            throw new PayrollAmountMismatchError(30000, 30050, 50);
        };

        const { req, res, getStatus, getJson } = fakeReqRes({
            staffId: '507f1f77bcf86cd799439011',
            month: '2026-06',
            amount: 30050,
            paymentMethod: 'cash',
        });

        await payrollController.processPayment(req, res);

        assert.equal(getStatus(), 409);
        assert.deepEqual(getJson(), {
            success: false,
            code: 'PAYROLL_AMOUNT_MISMATCH',
            message: 'Received amount differs from expected amount.',
            requiresConfirmation: true,
            data: {
                expectedAmount: 30000,
                receivedAmount: 30050,
                difference: 50,
            },
        });
        assert.equal(calledWith.confirm, false, 'omitted confirm must default to false, not undefined');
    });

    test('confirm: true in the request body is forwarded to processPayroll as a strict boolean', async () => {
        let calledWith: any;
        (payrollService as any).processPayroll = async (params: any) => {
            calledWith = params;
            return { _id: 'expense-1' };
        };

        const { req, res, getStatus } = fakeReqRes({
            staffId: '507f1f77bcf86cd799439011',
            month: '2026-06',
            amount: 30050,
            paymentMethod: 'cash',
            confirm: true,
        });

        await payrollController.processPayment(req, res);

        assert.equal(getStatus(), 200);
        assert.equal(calledWith.confirm, true);
    });

    test('a non-mismatch error ("locked") still maps to 400, unaffected by the new mismatch handling', async () => {
        (payrollService as any).processPayroll = async () => {
            throw new Error('Payroll for 2026-06 is locked. Unlock it before making changes.');
        };

        const { req, res, getStatus, getJson } = fakeReqRes({
            staffId: '507f1f77bcf86cd799439011',
            month: '2026-06',
            amount: 30000,
            paymentMethod: 'cash',
        });

        await payrollController.processPayment(req, res);

        assert.equal(getStatus(), 400);
        assert.equal((getJson() as any).success, false);
    });

    test('a generic error still maps to 500, unaffected by the new mismatch handling', async () => {
        (payrollService as any).processPayroll = async () => {
            throw new Error('Something else went wrong');
        };

        const { req, res, getStatus } = fakeReqRes({
            staffId: '507f1f77bcf86cd799439011',
            month: '2026-06',
            amount: 30000,
            paymentMethod: 'cash',
        });

        await payrollController.processPayment(req, res);

        assert.equal(getStatus(), 500);
    });
});
