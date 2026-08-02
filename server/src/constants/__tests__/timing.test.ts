/**
 * Unit tests for E6-F2-T2: named time-window constants extracted from
 * quotation.service.ts and order.service.ts. Pins the values so a future
 * accidental edit here is caught, since these constants replaced bare
 * literals whose exact values matter (token/access expiry, idempotency
 * window) — this is a value-preserving refactor, not a behavior change.
 *
 * Run with: node --import tsx --test src/constants/__tests__/timing.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN_EXPIRY_DAYS, DUPLICATE_QUOTATION_WINDOW_MS, ASSET_ACCESS_WINDOW_DAYS } from '../timing.js';

describe('timing constants (E6-F2-T2) — values match the literals they replaced', () => {
    test('TOKEN_EXPIRY_DAYS is 30 (quotation.service.ts)', () => {
        assert.equal(TOKEN_EXPIRY_DAYS, 30);
    });

    test('DUPLICATE_QUOTATION_WINDOW_MS is 5 minutes in ms (quotation.service.ts)', () => {
        assert.equal(DUPLICATE_QUOTATION_WINDOW_MS, 5 * 60 * 1000);
    });

    test('ASSET_ACCESS_WINDOW_DAYS is 7 (order.service.ts)', () => {
        assert.equal(ASSET_ACCESS_WINDOW_DAYS, 7);
    });
});
