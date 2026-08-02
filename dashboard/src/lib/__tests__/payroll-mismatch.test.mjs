/**
 * Unit tests for E1-F2-T2's frontend companion: the pure helpers in
 * payroll-mismatch.ts that (1) recognize a 409 PAYROLL_AMOUNT_MISMATCH
 * RTK Query error and extract its structured details, and (2) summarize a
 * bulk-payment API result (which always responds 200 and reports per-staff
 * outcomes in results/errors) into counts + a bounded error-line list.
 *
 * Run with: node --test src/lib/__tests__/payroll-mismatch.test.mjs
 * (run from the `dashboard/` directory)
 *
 * Written as plain .mjs, not .ts, for the same reason as
 * src/constants/__tests__/orderStatusWorkflow.test.mjs (E1-F1-T2): Node's
 * ESM loader needs the literal .ts extension in the import specifier to
 * resolve it, but that specifier only type-checks under tsc with
 * allowImportingTsExtensions enabled — a project-wide compiler flag this
 * task avoids adding. tsconfig.json's include list covers only .ts/.tsx/.mts
 * sources, so this .mjs file falls outside it entirely; tsc never sees the
 * import. Node's runtime resolution doesn't care what parsed the importer,
 * so this still exercises the real payroll-mismatch.ts module directly.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    getPayrollAmountMismatchDetails,
    summarizeBulkPayrollResult,
} from '../payroll-mismatch.ts';

describe('getPayrollAmountMismatchDetails', () => {
    test('recognizes a well-formed 409 PAYROLL_AMOUNT_MISMATCH error and extracts its details', () => {
        const error = {
            status: 409,
            data: {
                success: false,
                code: 'PAYROLL_AMOUNT_MISMATCH',
                message: 'Received amount differs from expected amount.',
                requiresConfirmation: true,
                data: {
                    expectedAmount: 30000,
                    receivedAmount: 30050,
                    difference: 50,
                },
            },
        };

        assert.deepEqual(getPayrollAmountMismatchDetails(error), {
            expectedAmount: 30000,
            receivedAmount: 30050,
            difference: 50,
        });
    });

    test('a negative difference (deduction case) is preserved as-is, not made absolute', () => {
        const error = {
            status: 409,
            data: {
                code: 'PAYROLL_AMOUNT_MISMATCH',
                data: { expectedAmount: 30000, receivedAmount: 29940, difference: -60 },
            },
        };

        assert.deepEqual(getPayrollAmountMismatchDetails(error), {
            expectedAmount: 30000,
            receivedAmount: 29940,
            difference: -60,
        });
    });

    test('a 409 for a different reason (wrong code) is not treated as a mismatch', () => {
        const error = {
            status: 409,
            data: { code: 'SOME_OTHER_CONFLICT', message: 'Conflict' },
        };
        assert.equal(getPayrollAmountMismatchDetails(error), null);
    });

    test('a non-409 status is never treated as a mismatch, even with the right code/shape', () => {
        const error = {
            status: 400,
            data: {
                code: 'PAYROLL_AMOUNT_MISMATCH',
                data: { expectedAmount: 1, receivedAmount: 2, difference: 1 },
            },
        };
        assert.equal(getPayrollAmountMismatchDetails(error), null);
    });

    test('a locked-month error (400, plain message) is not treated as a mismatch', () => {
        const error = {
            status: 400,
            data: { success: false, message: 'Payroll for 2026-06 is locked. Unlock it before making changes.' },
        };
        assert.equal(getPayrollAmountMismatchDetails(error), null);
    });

    test('malformed/missing nested data does not throw, returns null', () => {
        assert.equal(getPayrollAmountMismatchDetails({ status: 409, data: { code: 'PAYROLL_AMOUNT_MISMATCH' } }), null);
        assert.equal(getPayrollAmountMismatchDetails({ status: 409, data: null }), null);
        assert.equal(getPayrollAmountMismatchDetails({ status: 409 }), null);
        assert.equal(
            getPayrollAmountMismatchDetails({
                status: 409,
                data: { code: 'PAYROLL_AMOUNT_MISMATCH', data: { expectedAmount: '30000', receivedAmount: 30050, difference: 50 } },
            }),
            null,
            'non-numeric fields must not be coerced — treated as malformed',
        );
    });

    test('non-object and nullish inputs never throw', () => {
        assert.equal(getPayrollAmountMismatchDetails(null), null);
        assert.equal(getPayrollAmountMismatchDetails(undefined), null);
        assert.equal(getPayrollAmountMismatchDetails('network error'), null);
        assert.equal(getPayrollAmountMismatchDetails(new Error('boom')), null);
    });
});

describe('summarizeBulkPayrollResult', () => {
    const label = (staffId) => ({ 's1': 'Alice', 's2': 'Bob', 's3': 'Carol' })[staffId] || staffId;

    test('all succeeded: hasFailures is false, no error lines', () => {
        const summary = summarizeBulkPayrollResult(
            { results: [{ staffId: 's1', status: 'success', expenseId: 'e1' }, { staffId: 's2', status: 'success', expenseId: 'e2' }], errors: [] },
            label,
        );
        assert.deepEqual(summary, {
            successCount: 2,
            failureCount: 0,
            hasFailures: false,
            errorLines: [],
            additionalErrorCount: 0,
        });
    });

    test('partial failure: hasFailures true, counts and labeled error lines correct', () => {
        const summary = summarizeBulkPayrollResult(
            {
                results: [{ staffId: 's1', status: 'success', expenseId: 'e1' }],
                errors: [{ staffId: 's2', status: 'failed', message: 'Received amount differs from expected amount.' }],
            },
            label,
        );
        assert.equal(summary.successCount, 1);
        assert.equal(summary.failureCount, 1);
        assert.equal(summary.hasFailures, true);
        assert.deepEqual(summary.errorLines, ['Bob: Received amount differs from expected amount.']);
        assert.equal(summary.additionalErrorCount, 0);
    });

    test('all failed (zero successes): still hasFailures true, not silently equivalent to success', () => {
        const summary = summarizeBulkPayrollResult(
            { results: [], errors: [{ staffId: 's1', status: 'failed', message: 'Staff not found' }] },
            label,
        );
        assert.equal(summary.successCount, 0);
        assert.equal(summary.hasFailures, true);
    });

    test('more failures than maxLines: error lines are bounded and additionalErrorCount reflects the rest', () => {
        const errors = [
            { staffId: 's1', status: 'failed', message: 'err1' },
            { staffId: 's2', status: 'failed', message: 'err2' },
            { staffId: 's3', status: 'failed', message: 'err3' },
            { staffId: 's4', status: 'failed', message: 'err4' },
            { staffId: 's5', status: 'failed', message: 'err5' },
        ];
        const summary = summarizeBulkPayrollResult({ results: [], errors }, label, 3);
        assert.equal(summary.failureCount, 5);
        assert.equal(summary.errorLines.length, 3);
        assert.equal(summary.additionalErrorCount, 2);
    });

    test('unlabeled staffId falls back to the raw id', () => {
        const summary = summarizeBulkPayrollResult(
            { results: [], errors: [{ staffId: 'unknown-id', status: 'failed', message: 'boom' }] },
            label,
        );
        assert.deepEqual(summary.errorLines, ['unknown-id: boom']);
    });
});
