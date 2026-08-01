/**
 * Unit tests for E1-F1-T2: the single shared order-status transition table
 * now used by both orders/[id]/page.tsx and orders/page.tsx.
 *
 * Run with: node --test src/constants/__tests__/orderStatusWorkflow.test.mjs
 * (run from the `dashboard/` directory)
 *
 * Written as plain .mjs, not .ts, and deliberately: this file must import
 * orderStatusWorkflow.ts by its literal path (Node's ESM loader has no
 * extensionless resolution and needs the real extension to find it), but
 * a .ts-suffixed import specifier only type-checks under tsc with
 * allowImportingTsExtensions enabled — a project-wide compiler flag this
 * task intentionally avoids adding. tsconfig.json's include list covers
 * only .ts, .tsx, and .mts source files, so a plain .mjs file falls
 * outside it entirely and tsc never parses this file or sees that import
 * specifier at all. Node's own runtime resolution doesn't care what
 * parsed the importer, so this still exercises the real
 * orderStatusWorkflow.ts module directly — no test framework or
 * transpiler dependency added, same zero-new-dependency approach used for
 * every backend test this session.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_STATUS_WORKFLOW, getFilteredStatusOptions } from '../orderStatusWorkflow.ts';

const ALL_STATUSES = [
    'pending',
    'in_progress',
    'revision',
    'completed',
    'delivered',
    'cancelled',
];

function orderWithStatus(status) {
    return { status };
}

describe('ORDER_STATUS_WORKFLOW — matches server/src/models/order.model.ts ALLOWED_STATUS_TRANSITIONS', () => {
    test('every status has a table entry', () => {
        for (const status of ALL_STATUSES) {
            assert.ok(
                Object.prototype.hasOwnProperty.call(ORDER_STATUS_WORKFLOW, status),
                `ORDER_STATUS_WORKFLOW is missing an entry for "${status}"`,
            );
        }
    });

    test('table values match the backend transition table exactly', () => {
        // Mirrors ALLOWED_STATUS_TRANSITIONS in server/src/models/order.model.ts.
        // If this test ever fails, either this table or the backend's has
        // drifted — that drift is exactly what E1-F1-T1/E1-F1-T2 exist to
        // prevent, so treat a failure here as a real bug, not a flaky test.
        assert.deepEqual(ORDER_STATUS_WORKFLOW, {
            pending: ['in_progress', 'cancelled'],
            in_progress: ['completed', 'revision', 'cancelled'],
            revision: ['in_progress', 'cancelled'],
            completed: ['delivered', 'revision'],
            delivered: ['revision'],
            cancelled: [],
        });
    });

    test('cancelled is terminal (no outgoing transitions), same as the backend', () => {
        assert.deepEqual(ORDER_STATUS_WORKFLOW.cancelled, []);
    });
});

describe('getFilteredStatusOptions — the function both order pages now share', () => {
    test('never includes the current status in its own result', () => {
        for (const status of ALL_STATUSES) {
            const options = getFilteredStatusOptions(orderWithStatus(status));
            assert.ok(!options.includes(status), `options for "${status}" must not include itself`);
        }
    });

    test('returns exactly ORDER_STATUS_WORKFLOW[status] minus self, for every status', () => {
        for (const status of ALL_STATUSES) {
            const expected = ORDER_STATUS_WORKFLOW[status].filter((s) => s !== status);
            assert.deepEqual(getFilteredStatusOptions(orderWithStatus(status)), expected);
        }
    });

    test('a cancelled order offers zero next-status options — the exact bug E1-F1-T2 fixes', () => {
        // Before this fix, the order LIST page's own (now-removed) local
        // implementation would have offered all 5 other statuses here,
        // including transitions the backend rejects with a 409.
        assert.deepEqual(getFilteredStatusOptions(orderWithStatus('cancelled')), []);
    });

    test('a pending order offers exactly [in_progress, cancelled]', () => {
        assert.deepEqual(getFilteredStatusOptions(orderWithStatus('pending')), [
            'in_progress',
            'cancelled',
        ]);
    });
});
