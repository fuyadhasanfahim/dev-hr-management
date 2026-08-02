/**
 * Unit tests for E1-F2-T2: `processPaymentSchema` correctly accepts and
 * defaults the new `confirm` field.
 *
 * Regression motivation: Zod's `z.object()` strips unrecognized keys by
 * default, and `validate()` middleware (payroll.validator.ts) replaces
 * `req.body` with the parsed result — so if `confirm` were left out of
 * this schema, it would be silently dropped from every request before
 * ever reaching the controller, regardless of what the client sent. This
 * was caught during E1-F2-T2 implementation, before it could ship as a
 * live bug; this test pins the fix.
 *
 * Run with: node --import tsx --test src/validators/__tests__/payroll-validator.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { processPaymentSchema } from '../payroll.validator.js';

const BASE_BODY = {
    staffId: '507f1f77bcf86cd799439011',
    month: '2026-06',
    amount: 30000,
};

describe('processPaymentSchema — confirm field (E1-F2-T2)', () => {
    test('confirm omitted: defaults to false, is not stripped', () => {
        const result = processPaymentSchema.safeParse(BASE_BODY);
        assert.ok(result.success);
        assert.equal(result.data.confirm, false);
    });

    test('confirm: true is preserved through parsing', () => {
        const result = processPaymentSchema.safeParse({ ...BASE_BODY, confirm: true });
        assert.ok(result.success);
        assert.equal(result.data.confirm, true);
    });

    test('confirm: false is preserved through parsing (not coerced to the default)', () => {
        const result = processPaymentSchema.safeParse({ ...BASE_BODY, confirm: false });
        assert.ok(result.success);
        assert.equal(result.data.confirm, false);
    });

    test('a non-boolean confirm value fails validation rather than being silently coerced', () => {
        const result = processPaymentSchema.safeParse({ ...BASE_BODY, confirm: 'yes' });
        assert.equal(result.success, false);
    });

    test('other fields are unaffected by the new confirm field', () => {
        const result = processPaymentSchema.safeParse(BASE_BODY);
        assert.ok(result.success);
        assert.equal(result.data.paymentMethod, 'cash');
        assert.equal(result.data.bonus, 0);
        assert.equal(result.data.deduction, 0);
        assert.equal(result.data.paymentType, 'salary');
    });
});
