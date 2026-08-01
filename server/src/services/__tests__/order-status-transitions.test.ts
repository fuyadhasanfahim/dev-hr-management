/**
 * Unit tests for E1-F1-T1: enforcement of ALLOWED_STATUS_TRANSITIONS in
 * OrderService.transitionStatus.
 *
 * Scope note: this suite tests `assertValidOrderTransition` directly — a
 * pure function with no DB/Mongoose I/O — rather than the full
 * `transitionStatus` service function, which requires a live/in-memory
 * MongoDB connection. Standing up DB-backed test infrastructure
 * (mongodb-memory-server, a test runner config, etc.) is the scope of
 * E7-F1-T1 and is intentionally not introduced here, per the instruction to
 * implement E1-F1-T1 only. This suite still fully covers the actual change
 * made in this task: the guard clause and its 36-case transition matrix.
 *
 * Run with: node --import tsx --test src/services/__tests__/order-status-transitions.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assertValidOrderTransition } from '../order.service.js';
import { ALLOWED_STATUS_TRANSITIONS, OrderStatus } from '../../models/order.model.js';
import { AppError } from '../../utils/AppError.js';

const ALL_STATUSES = Object.values(OrderStatus);

describe('assertValidOrderTransition — full 6x6 transition matrix (36 cases)', () => {
    for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
            const isAllowed = ALLOWED_STATUS_TRANSITIONS[from].includes(to);
            const label = `${from} -> ${to} (${isAllowed ? 'allowed' : 'rejected'})`;

            test(label, () => {
                if (isAllowed) {
                    assert.doesNotThrow(() => assertValidOrderTransition(from, to));
                } else {
                    assert.throws(
                        () => assertValidOrderTransition(from, to),
                        (err: unknown) => {
                            assert.ok(err instanceof AppError, 'error must be an AppError');
                            assert.equal((err as AppError).statusCode, 409);
                            assert.match(
                                (err as AppError).message,
                                /Invalid order transition/,
                            );
                            return true;
                        },
                    );
                }
            });
        }
    }
});

describe('assertValidOrderTransition — table sanity checks', () => {
    test('covers all 6 OrderStatus values as "from" keys', () => {
        assert.equal(Object.keys(ALLOWED_STATUS_TRANSITIONS).length, ALL_STATUSES.length);
        for (const status of ALL_STATUSES) {
            assert.ok(
                Object.prototype.hasOwnProperty.call(ALLOWED_STATUS_TRANSITIONS, status),
                `ALLOWED_STATUS_TRANSITIONS is missing an entry for ${status}`,
            );
        }
    });

    test('CANCELLED is terminal (no outgoing transitions)', () => {
        assert.deepEqual(ALLOWED_STATUS_TRANSITIONS[OrderStatus.CANCELLED], []);
        for (const to of ALL_STATUSES) {
            assert.throws(() => assertValidOrderTransition(OrderStatus.CANCELLED, to));
        }
    });

    test('no self-transitions are permitted by the current table', () => {
        // Documents the known behavior change called out in the E1-F1-T1 plan:
        // resubmitting the current status now throws 409 instead of silently
        // succeeding. Mirrors the existing Quotation model's transition table,
        // which also excludes self-transitions.
        for (const status of ALL_STATUSES) {
            assert.ok(
                !ALLOWED_STATUS_TRANSITIONS[status].includes(status),
                `${status} unexpectedly allows a self-transition`,
            );
            assert.throws(() => assertValidOrderTransition(status, status));
        }
    });

    test('a representative valid transition (PENDING -> IN_PROGRESS) does not throw', () => {
        assert.doesNotThrow(() =>
            assertValidOrderTransition(OrderStatus.PENDING, OrderStatus.IN_PROGRESS),
        );
    });

    test('a representative invalid transition (CANCELLED -> DELIVERED) throws 409 — the exact bug this task fixes', () => {
        assert.throws(
            () => assertValidOrderTransition(OrderStatus.CANCELLED, OrderStatus.DELIVERED),
            (err: unknown) => {
                assert.ok(err instanceof AppError);
                assert.equal((err as AppError).statusCode, 409);
                return true;
            },
        );
    });
});
