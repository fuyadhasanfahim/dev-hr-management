/**
 * Tests for E6-F1-T1: wiring up quotation-timeline.controller.ts (confirmed
 * genuinely orphaned — zero references anywhere else in the codebase prior
 * to this task; wallet-transaction.controller.ts, the backlog's other
 * originally-claimed "orphan", was found already fully wired in
 * staff.route.ts and needed no change).
 *
 * Scope note: mirrors outbox-route.test.ts's approach (E4-F1-T1) — inspects
 * Express's real Router.stack on the actual exported route object and
 * invokes the real wired authorize(...) middleware directly. A live
 * HTTP+DB integration test (getTimeline actually returning merged
 * quotation/outbox/order data) needs infrastructure this sandbox doesn't
 * have — same documented limitation as every DB-touching task this session.
 *
 * Run with: node --import tsx --test src/routes/__tests__/quotation-timeline-route.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response, NextFunction } from 'express';
import { quotationTimelineRoute } from '../quotation-timeline.route.js';
import { QuotationTimelineController } from '../../controllers/quotation-timeline.controller.js';

type RouteEntry = { path: string; methods: string[]; handlers: Function[] };

function getRoutes(): RouteEntry[] {
    return (quotationTimelineRoute.stack as any[])
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

describe('quotationTimelineRoute — registered endpoints (E6-F1-T1)', () => {
    const routes = getRoutes();

    test('GET /:quotationGroupId is registered with 2 handlers (authorize + controller)', () => {
        const r = routes.find((x) => x.path === '/:quotationGroupId' && x.methods.includes('get'));
        assert.ok(r, 'GET /:quotationGroupId not registered');
        assert.equal(r!.handlers.length, 2);
        assert.equal(r!.handlers[1], QuotationTimelineController.getTimeline);
    });

    test('POST /:quotationGroupId/replay is registered with 2 handlers (authorize + controller)', () => {
        const r = routes.find((x) => x.path === '/:quotationGroupId/replay' && x.methods.includes('post'));
        assert.ok(r, 'POST /:quotationGroupId/replay not registered');
        assert.equal(r!.handlers.length, 2);
        assert.equal(r!.handlers[1], QuotationTimelineController.requestReplay);
    });

    test('POST /:quotationGroupId/regenerate-link is registered with 2 handlers (authorize + controller)', () => {
        const r = routes.find((x) => x.path === '/:quotationGroupId/regenerate-link' && x.methods.includes('post'));
        assert.ok(r, 'POST /:quotationGroupId/regenerate-link not registered');
        assert.equal(r!.handlers.length, 2);
        assert.equal(r!.handlers[1], QuotationTimelineController.requestRegenerateLink);
    });
});

describe('quotationTimelineRoute — AuthZ gate on every route (E6-F1-T1)', () => {
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
