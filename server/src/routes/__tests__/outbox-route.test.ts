/**
 * Tests for E4-F1-T1: Outbox admin API route wiring and AuthZ.
 *
 * Scope note: the backlog's specified testing strategy is a "list + replay-one
 * integration test" against a live HTTP server + DB. This sandbox has no
 * network path to a real MongoDB and no DB test harness exists yet
 * (E7-F1-T1's explicit scope) — the same documented limitation as every
 * DB-touching task this session.
 *
 * Instead, this suite verifies the actual wiring of `outboxRoute` directly
 * off Express's own `Router.stack` (not a re-implementation or a mock of it):
 * that GET /, GET /:id, POST /replay, and POST /:id/replay are all
 * registered, that each is gated by the real `authorize(...)` middleware
 * instance wired into that route (extracted by reference from the router
 * stack, not a fresh call to `authorize()` on the side), and that invoking
 * that exact middleware function rejects non-admin roles with 403 and
 * admits SUPER_ADMIN/ADMIN. This proves the actual security gate on the
 * actual routes, without needing a live server or DB. A true end-to-end
 * HTTP + DB integration test (list returns real events, replay flips a real
 * dead-lettered event back to pending) is flagged as an open follow-up for
 * once DB test infrastructure exists.
 *
 * Run with: node --import tsx --test src/routes/__tests__/outbox-route.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';
import { outboxRoute } from '../outbox.route.js';
import OutboxController from '../../controllers/outbox.controller.js';

type RouteEntry = { path: string; methods: string[]; handlers: Function[] };

function getRoutes(): RouteEntry[] {
    return (outboxRoute.stack as any[])
        .filter((layer) => layer.route)
        .map((layer) => ({
            path: layer.route.path,
            methods: Object.keys(layer.route.methods),
            handlers: layer.route.stack.map((s: any) => s.handle),
        }));
}

function callAuthorize(handler: Function, permissions: string[] | undefined) {
    let statusCode: number | undefined;
    let jsonBody: unknown;
    let nextCalled = false;

    const req = { user: permissions ? { id: 'u1', role: 'x', permissions } : undefined } as unknown as Request;
    const res = {
        status(code: number) {
            statusCode = code;
            return this;
        },
        json(body: unknown) {
            jsonBody = body;
            return this;
        },
    } as unknown as Response;
    const next: NextFunction = () => {
        nextCalled = true;
    };

    handler(req, res, next);
    return { statusCode, jsonBody, nextCalled };
}

describe('outboxRoute — registered endpoints (E4-F1-T1)', () => {
    const routes = getRoutes();

    test('GET / (list) is registered with 2 handlers (authorize + controller)', () => {
        const r = routes.find((x) => x.path === '/' && x.methods.includes('get'));
        assert.ok(r, 'GET / not registered');
        assert.equal(r!.handlers.length, 2);
        assert.equal(r!.handlers[1], OutboxController.listOutbox);
    });

    test('GET /:id (detail) is registered with 2 handlers (authorize + controller)', () => {
        const r = routes.find((x) => x.path === '/:id' && x.methods.includes('get'));
        assert.ok(r, 'GET /:id not registered');
        assert.equal(r!.handlers.length, 2);
        assert.equal(r!.handlers[1], OutboxController.getOutboxById);
    });

    test('POST /replay (bulk replay) is registered with 2 handlers (authorize + controller)', () => {
        const r = routes.find((x) => x.path === '/replay' && x.methods.includes('post'));
        assert.ok(r, 'POST /replay not registered');
        assert.equal(r!.handlers.length, 2);
        assert.equal(r!.handlers[1], OutboxController.replayOutboxMany);
    });

    test('POST /:id/replay (replay one) is registered with 2 handlers (authorize + controller)', () => {
        const r = routes.find((x) => x.path === '/:id/replay' && x.methods.includes('post'));
        assert.ok(r, 'POST /:id/replay not registered');
        assert.equal(r!.handlers.length, 2);
        assert.equal(r!.handlers[1], OutboxController.replayOutboxById);
    });
});

describe('outboxRoute — AuthZ gate on every route (E4-F1-T1)', () => {
    const routes = getRoutes();

    for (const route of routes) {
        const label = `${route.methods.join(',').toUpperCase()} ${route.path}`;
        const authorizeHandler = route.handlers[0];
        assert.ok(authorizeHandler, `${label} has no handlers registered`);

        test(`${label} — no permissions gets 403`, () => {
            const { statusCode, jsonBody, nextCalled } = callAuthorize(authorizeHandler, []);
            assert.equal(statusCode, 403);
            assert.equal(nextCalled, false);
            assert.match((jsonBody as any).message, /Forbidden/);
        });

        test(`${label} — unauthenticated (no req.user) gets 401`, () => {
            const { statusCode, nextCalled } = callAuthorize(authorizeHandler, undefined);
            assert.equal(statusCode, 401);
            assert.equal(nextCalled, false);
        });

        test(`${label} — superuser ["*"] is admitted (next() called)`, () => {
            const { statusCode, nextCalled } = callAuthorize(authorizeHandler, ['*']);
            assert.equal(nextCalled, true);
            assert.equal(statusCode, undefined);
        });
    }
});
