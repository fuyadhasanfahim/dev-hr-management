/**
 * Unit tests for E5-F1-T2 Phase 1b: `requestReplay`'s change from
 * enqueueing an `admin.outbox.replay` Outbox event to calling
 * `OutboxService.replayMany` synchronously and directly.
 *
 * Follows this codebase's established monkey-patch pattern for exercising
 * Mongoose-model-dependent logic without a live database (same approach as
 * `receipt-zero-payment-race.test.ts` for E1-F3-T1): `OutboxEventModel.find`
 * and `OutboxService.replayMany` are monkey-patched per test, restored in
 * `afterEach`.
 *
 * Run with: node --import tsx --test src/controllers/__tests__/quotation-timeline-controller.test.ts
 * (run from the `server/` directory)
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { QuotationTimelineController } from '../quotation-timeline.controller.js';
import OutboxEventModel from '../../models/outbox-event.model.js';
import { OutboxService } from '../../services/outbox.service.js';

function fakeReqRes(overrides: { params?: any; body?: any; user?: any } = {}) {
    const req = {
        params: overrides.params ?? {},
        body: overrides.body ?? {},
        user: overrides.user ?? { id: 'admin-1' },
    } as unknown as Request;

    let statusCode: number | undefined;
    let jsonBody: unknown;
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

    return { req, res, getStatus: () => statusCode, getJson: () => jsonBody };
}

describe('requestReplay — direct synchronous replay (E5-F1-T2 Phase 1b, admin.outbox.replay removed)', () => {
    let originalFind: typeof OutboxEventModel.find;
    let originalReplayMany: typeof OutboxService.replayMany;

    beforeEach(() => {
        originalFind = OutboxEventModel.find;
        originalReplayMany = OutboxService.replayMany;
    });

    afterEach(() => {
        OutboxEventModel.find = originalFind;
        OutboxService.replayMany = originalReplayMany;
    });

    test('missing quotationGroupId: 400, never queries or replays', async () => {
        let findCalls = 0;
        (OutboxEventModel as any).find = () => {
            findCalls++;
            return { lean: async () => [] };
        };
        let replayManyCalls = 0;
        (OutboxService as any).replayMany = async () => {
            replayManyCalls++;
        };

        const { req, res, getStatus, getJson } = fakeReqRes({ params: {} });
        await QuotationTimelineController.requestReplay(req, res);

        assert.equal(getStatus(), 400);
        assert.match((getJson() as any).message, /quotationGroupId is required/);
        assert.equal(findCalls, 0);
        assert.equal(replayManyCalls, 0);
    });

    test('default mode ("failed_for_group"): resolves failed/dead_letter ids for the group, replays them, returns 200 synchronously', async () => {
        let findQuery: unknown;
        (OutboxEventModel as any).find = (query: unknown) => {
            findQuery = query;
            return {
                lean: async () => [{ _id: { toString: () => 'evt-1' } }, { _id: { toString: () => 'evt-2' } }],
            };
        };
        let replayManyCalledWith: unknown;
        (OutboxService as any).replayMany = async (ids: unknown) => {
            replayManyCalledWith = ids;
        };

        const { req, res, getStatus, getJson } = fakeReqRes({ params: { quotationGroupId: 'grp-1' } });
        await QuotationTimelineController.requestReplay(req, res);

        assert.deepEqual(findQuery, {
            aggregateId: 'grp-1',
            status: { $in: ['failed', 'dead_letter'] },
        });
        assert.deepEqual(replayManyCalledWith, ['evt-1', 'evt-2']);
        assert.equal(getStatus(), 200);
        assert.deepEqual(getJson(), {
            success: true,
            data: { replayedCount: 2, ids: ['evt-1', 'evt-2'] },
        });
    });

    test('explicit ids provided: uses them directly, does not query for failed/dead_letter events', async () => {
        let findCalls = 0;
        (OutboxEventModel as any).find = () => {
            findCalls++;
            return { lean: async () => [] };
        };
        let replayManyCalledWith: unknown;
        (OutboxService as any).replayMany = async (ids: unknown) => {
            replayManyCalledWith = ids;
        };

        const { req, res, getStatus, getJson } = fakeReqRes({
            params: { quotationGroupId: 'grp-2' },
            body: { ids: ['specific-1', 'specific-2'] },
        });
        await QuotationTimelineController.requestReplay(req, res);

        assert.equal(findCalls, 0, 'explicit ids must bypass the failed/dead_letter lookup entirely');
        assert.deepEqual(replayManyCalledWith, ['specific-1', 'specific-2']);
        assert.equal(getStatus(), 200);
        assert.deepEqual(getJson(), {
            success: true,
            data: { replayedCount: 2, ids: ['specific-1', 'specific-2'] },
        });
    });

    test('no failed/dead_letter events found: 200 with replayedCount 0, replayMany not called', async () => {
        (OutboxEventModel as any).find = () => ({ lean: async () => [] });
        let replayManyCalls = 0;
        (OutboxService as any).replayMany = async () => {
            replayManyCalls++;
        };

        const { req, res, getStatus, getJson } = fakeReqRes({ params: { quotationGroupId: 'grp-3' } });
        await QuotationTimelineController.requestReplay(req, res);

        assert.equal(replayManyCalls, 0, 'nothing to replay means replayMany must not be called at all');
        assert.equal(getStatus(), 200);
        assert.deepEqual(getJson(), { success: true, data: { replayedCount: 0, ids: [] } });
    });
});
