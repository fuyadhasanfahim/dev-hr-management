/**
 * Unit tests for E5-F1-T2: the Outbox worker's claim → dispatch →
 * mark-processed/failed core (`processNextOutboxEvent`/`drainOutboxEvents`)
 * and the handler registry, including the real handlers for all
 * currently-produced event types — `admin.quotation.regenerate_link`
 * (delegates to `QuotationService.sendQuotation()`), `quotation.superseded`
 * (confirmed no-op — "no automatic business action is required" — Phase
 * 1c), and confirming `admin.outbox.replay` has no handler at all (removed
 * as an event entirely, Phase 1b).
 *
 * `processNextOutboxEvent`/`drainOutboxEvents` take all their Mongo-backed
 * dependencies (`claimNext`/`markProcessed`/`markFailed`) as injected
 * functions, so these tests run against hand-rolled fakes — no live
 * MongoDB connection needed, same approach as lib/gracefulShutdown.test.ts
 * and lib/health.test.ts.
 *
 * Run with: node --import tsx --test src/services/__tests__/outbox-worker.test.ts
 * (run from the `server/` directory)
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { IOutboxEvent } from '../../models/outbox-event.model.js';
import {
    processNextOutboxEvent,
    drainOutboxEvents,
    registerOutboxHandler,
    getRegisteredOutboxHandler,
    type OutboxWorkerDeps,
} from '../outbox-worker.service.js';
import QuotationModel from '../../models/quotation.model.js';
import { QuotationService } from '../quotation.service.js';

function fakeEvent(overrides: Record<string, unknown> = {}): IOutboxEvent {
    return {
        _id: 'evt-1',
        eventName: 'test.event',
        payload: {},
        status: 'processing',
        attempts: 0,
        maxAttempts: 10,
        ...overrides,
    } as unknown as IOutboxEvent;
}

function makeDeps(overrides: Partial<OutboxWorkerDeps> & { queue?: IOutboxEvent[] } = {}) {
    const queue = overrides.queue ?? [];
    const processedCalls: Array<{ id: string; lockId: string }> = [];
    const failedCalls: Array<{ id: string; lockId: string; error: string }> = [];
    const logs: Array<{ level: string; event: string; meta: Record<string, unknown> }> = [];

    const deps: OutboxWorkerDeps = {
        claimNext: overrides.claimNext ?? (async () => queue.shift() ?? null),
        markProcessed: overrides.markProcessed ?? (async (id, lockId) => {
            processedCalls.push({ id, lockId });
        }),
        markFailed: overrides.markFailed ?? (async (id, lockId, error) => {
            failedCalls.push({ id, lockId, error });
        }),
        getHandler: overrides.getHandler ?? (() => undefined),
        onLog: overrides.onLog ?? ((level, event, meta) => logs.push({ level, event, meta })),
    };

    return { deps, processedCalls, failedCalls, logs, queue };
}

describe('processNextOutboxEvent', () => {
    test('empty queue: returns false, calls neither markProcessed nor markFailed', async () => {
        const { deps, processedCalls, failedCalls } = makeDeps({ queue: [] });

        const claimed = await processNextOutboxEvent('lock-1', deps);

        assert.equal(claimed, false);
        assert.equal(processedCalls.length, 0);
        assert.equal(failedCalls.length, 0);
    });

    test('claimed event with a successful handler: marks processed, not failed', async () => {
        const event = fakeEvent({ _id: 'evt-42', eventName: 'known.event' });
        let handlerCalledWith: IOutboxEvent | undefined;
        const { deps, processedCalls, failedCalls } = makeDeps({
            queue: [event],
            getHandler: () => async (e) => {
                handlerCalledWith = e;
            },
        });

        const claimed = await processNextOutboxEvent('lock-1', deps);

        assert.equal(claimed, true);
        assert.deepEqual(processedCalls, [{ id: 'evt-42', lockId: 'lock-1' }]);
        assert.equal(failedCalls.length, 0);
        assert.equal(handlerCalledWith?.eventName, 'known.event');
    });

    test('claimed event with no registered handler: marks failed with a clear message, not processed', async () => {
        const event = fakeEvent({ _id: 'evt-99', eventName: 'unregistered.event' });
        const { deps, processedCalls, failedCalls } = makeDeps({
            queue: [event],
            getHandler: () => undefined,
        });

        const claimed = await processNextOutboxEvent('lock-1', deps);

        assert.equal(claimed, true);
        assert.equal(processedCalls.length, 0);
        assert.equal(failedCalls.length, 1);
        assert.match(failedCalls[0]!.error, /No handler registered for Outbox event type "unregistered\.event"/);
    });

    test('handler throws: marks failed with the handler error message, not processed', async () => {
        const event = fakeEvent({ _id: 'evt-7', eventName: 'flaky.event' });
        const { deps, processedCalls, failedCalls } = makeDeps({
            queue: [event],
            getHandler: () => async () => {
                throw new Error('downstream boom');
            },
        });

        const claimed = await processNextOutboxEvent('lock-1', deps);

        assert.equal(claimed, true);
        assert.equal(processedCalls.length, 0);
        assert.deepEqual(failedCalls, [{ id: 'evt-7', lockId: 'lock-1', error: 'downstream boom' }]);
    });

    test('handler throws a non-Error value: still marks failed, stringifies the thrown value', async () => {
        const event = fakeEvent({ _id: 'evt-8' });
        const { deps, failedCalls } = makeDeps({
            queue: [event],
            getHandler: () => async () => {
                // eslint-disable-next-line @typescript-eslint/no-throw-literal
                throw 'a string thrown, not an Error';
            },
        });

        await processNextOutboxEvent('lock-1', deps);

        assert.deepEqual(failedCalls, [{ id: 'evt-8', lockId: 'lock-1', error: 'a string thrown, not an Error' }]);
    });
});

describe('drainOutboxEvents', () => {
    test('drains multiple events in one call, stops when the queue is empty', async () => {
        const events = [fakeEvent({ _id: 'a' }), fakeEvent({ _id: 'b' }), fakeEvent({ _id: 'c' })];
        const { deps, processedCalls } = makeDeps({
            queue: events,
            getHandler: () => async () => {},
        });

        const count = await drainOutboxEvents('lock-1', deps, 10);

        assert.equal(count, 3);
        assert.deepEqual(
            processedCalls.map((c) => c.id),
            ['a', 'b', 'c'],
        );
    });

    test('respects maxEvents even when more are claimable', async () => {
        const events = [fakeEvent({ _id: 'a' }), fakeEvent({ _id: 'b' }), fakeEvent({ _id: 'c' })];
        const { deps, processedCalls } = makeDeps({
            queue: events,
            getHandler: () => async () => {},
        });

        const count = await drainOutboxEvents('lock-1', deps, 2);

        assert.equal(count, 2);
        assert.equal(processedCalls.length, 2);
    });

    test('shouldStop() true before any claim: drains zero, never calls claimNext', async () => {
        let claimNextCalls = 0;
        const { deps } = makeDeps({
            claimNext: async () => {
                claimNextCalls++;
                return null;
            },
        });

        const count = await drainOutboxEvents('lock-1', deps, 10, () => true);

        assert.equal(count, 0);
        assert.equal(claimNextCalls, 0);
    });

    test('shouldStop() flips true mid-drain: stops early instead of draining everything', async () => {
        const events = [fakeEvent({ _id: 'a' }), fakeEvent({ _id: 'b' }), fakeEvent({ _id: 'c' })];
        const { deps, processedCalls } = makeDeps({
            queue: events,
            getHandler: () => async () => {},
        });

        let stopAfter = 1;
        const count = await drainOutboxEvents('lock-1', deps, 10, () => stopAfter-- <= 0);

        assert.equal(count, 1);
        assert.deepEqual(processedCalls.map((c) => c.id), ['a']);
    });
});

describe('handler registry — quotation.superseded is a confirmed no-op (Phase 1c)', () => {
    test('"quotation.superseded" has a registered handler that resolves successfully, performing no side effects', async () => {
        const handler = getRegisteredOutboxHandler('quotation.superseded');
        assert.ok(handler, 'expected a handler to be registered for "quotation.superseded"');

        const result = await handler!(fakeEvent({ eventName: 'quotation.superseded' }));

        assert.equal(result, undefined, 'the no-op handler must simply resolve, not throw or return a value');
    });

    test('end-to-end via processNextOutboxEvent: a quotation.superseded claim is marked processed, never failed', async () => {
        const event = fakeEvent({ _id: 'evt-superseded-1', eventName: 'quotation.superseded' });
        const { deps, processedCalls, failedCalls } = makeDeps({
            queue: [event],
            getHandler: getRegisteredOutboxHandler,
        });

        const claimed = await processNextOutboxEvent('lock-1', deps);

        assert.equal(claimed, true);
        assert.deepEqual(processedCalls, [{ id: 'evt-superseded-1', lockId: 'lock-1' }]);
        assert.equal(failedCalls.length, 0);
    });
});

describe('handler registry — admin.outbox.replay was removed entirely (Phase 1b)', () => {
    test('no handler is registered for "admin.outbox.replay" — nothing produces this event anymore', () => {
        assert.equal(getRegisteredOutboxHandler('admin.outbox.replay'), undefined);
    });
});

describe('admin.quotation.regenerate_link — real handler (Phase 1b)', () => {
    let originalFindOne: typeof QuotationModel.findOne;
    let originalSendQuotation: typeof QuotationService.sendQuotation;

    beforeEach(() => {
        originalFindOne = QuotationModel.findOne;
        originalSendQuotation = QuotationService.sendQuotation;
    });

    afterEach(() => {
        QuotationModel.findOne = originalFindOne;
        QuotationService.sendQuotation = originalSendQuotation;
    });

    function getHandler() {
        const handler = getRegisteredOutboxHandler('admin.quotation.regenerate_link');
        assert.ok(handler, 'expected a real handler to be registered for "admin.quotation.regenerate_link"');
        return handler!;
    }

    test('missing quotationGroupId in payload: throws a clear error, never calls sendQuotation', async () => {
        let sendQuotationCalls = 0;
        (QuotationService as any).sendQuotation = async () => {
            sendQuotationCalls++;
        };

        await assert.rejects(
            () => getHandler()(fakeEvent({ eventName: 'admin.quotation.regenerate_link', payload: {} })),
            /missing a valid "quotationGroupId"/,
        );
        assert.equal(sendQuotationCalls, 0);
    });

    test('no latest quotation found for the group: throws a clear error, never calls sendQuotation', async () => {
        let findOneCalls = 0;
        let sendQuotationCalls = 0;
        (QuotationModel as any).findOne = async (query: any) => {
            findOneCalls++;
            assert.deepEqual(query, { quotationGroupId: 'grp-1', isLatestVersion: true });
            return null;
        };
        (QuotationService as any).sendQuotation = async () => {
            sendQuotationCalls++;
        };

        await assert.rejects(
            () =>
                getHandler()(
                    fakeEvent({
                        eventName: 'admin.quotation.regenerate_link',
                        payload: { quotationGroupId: 'grp-1' },
                    }),
                ),
            /no latest quotation found for quotationGroupId "grp-1"/,
        );
        assert.equal(findOneCalls, 1);
        assert.equal(sendQuotationCalls, 0);
    });

    test('happy path: resolves the latest quotation and delegates to QuotationService.sendQuotation unchanged', async () => {
        const latest = { _id: { toString: () => 'quotation-id-42' } };
        (QuotationModel as any).findOne = async () => latest;

        let sendQuotationCalledWith: unknown[] = [];
        (QuotationService as any).sendQuotation = async (...args: unknown[]) => {
            sendQuotationCalledWith = args;
        };

        await getHandler()(
            fakeEvent({
                eventName: 'admin.quotation.regenerate_link',
                payload: { quotationGroupId: 'grp-2', actorUserId: 'user-9' },
            }),
        );

        assert.deepEqual(sendQuotationCalledWith, ['quotation-id-42', 'user-9']);
    });

    test('missing actorUserId in payload: still calls sendQuotation, with an empty-string userId', async () => {
        const latest = { _id: { toString: () => 'quotation-id-7' } };
        (QuotationModel as any).findOne = async () => latest;

        let sendQuotationCalledWith: unknown[] = [];
        (QuotationService as any).sendQuotation = async (...args: unknown[]) => {
            sendQuotationCalledWith = args;
        };

        await getHandler()(
            fakeEvent({ eventName: 'admin.quotation.regenerate_link', payload: { quotationGroupId: 'grp-3' } }),
        );

        assert.deepEqual(sendQuotationCalledWith, ['quotation-id-7', '']);
    });
});

describe('handler registry — general round-trip behavior', () => {
    test('registerOutboxHandler + getRegisteredOutboxHandler round-trip for a fresh event name', async () => {
        let called = false;
        registerOutboxHandler('test.roundtrip.event', async () => {
            called = true;
        });

        const handler = getRegisteredOutboxHandler('test.roundtrip.event');
        assert.ok(handler);
        await handler!(fakeEvent({ eventName: 'test.roundtrip.event' }));
        assert.equal(called, true);
    });

    test('an event name with no registration at all resolves to undefined', () => {
        assert.equal(getRegisteredOutboxHandler('never.registered.event'), undefined);
    });
});
