/**
 * Unit tests for E3-F1-T1: GET /healthz decision logic.
 *
 * `getHealthStatus` has no mongoose/DB import — it's a pure function of
 * `mongoose.connection.readyState`, so it's tested directly here without
 * needing a real (or even mocked) database connection.
 *
 * Run with: node --import tsx --test src/lib/__tests__/health.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getHealthStatus } from '../health.js';

describe('getHealthStatus', () => {
    test('readyState 1 (connected) -> 200, db connected', () => {
        const { statusCode, body } = getHealthStatus(1);
        assert.equal(statusCode, 200);
        assert.equal(body.success, true);
        assert.equal(body.status, 'ok');
        assert.equal(body.db, 'connected');
    });

    test('readyState 0 (disconnected) -> 503, db disconnected', () => {
        const { statusCode, body } = getHealthStatus(0);
        assert.equal(statusCode, 503);
        assert.equal(body.success, false);
        assert.equal(body.status, 'unavailable');
        assert.equal(body.db, 'disconnected');
    });

    test('readyState 2 (connecting) -> 503, not yet ready', () => {
        const { statusCode, body } = getHealthStatus(2);
        assert.equal(statusCode, 503);
        assert.equal(body.db, 'disconnected');
    });

    test('readyState 3 (disconnecting) -> 503, not usable', () => {
        const { statusCode, body } = getHealthStatus(3);
        assert.equal(statusCode, 503);
        assert.equal(body.db, 'disconnected');
    });

    test('an unexpected/unknown readyState value is treated as unhealthy, not a crash', () => {
        const { statusCode, body } = getHealthStatus(99);
        assert.equal(statusCode, 503);
        assert.equal(body.db, 'disconnected');
    });
});
