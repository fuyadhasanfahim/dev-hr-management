/**
 * E5-F1-T2 — Outbox worker: claim/dispatch/mark infrastructure (Phase 1a)
 * plus real business handlers where the E5-F1-T2 investigation could prove
 * intent from the existing codebase without guessing (Phase 1b).
 *
 * This module is the first thing that ever calls `OutboxService.claimNext`/
 * `markProcessed`/`markFailed` (confirmed via full-tree grep during the
 * E5-F1-T2 design pass: those three methods previously had zero callers —
 * every enqueued event has sat in `pending` since the Outbox pattern was
 * introduced). It provides the claim → dispatch → mark-processed/failed
 * loop and a name-based handler registry.
 *
 * Event-by-event status (Phase 1b investigation):
 * - `admin.quotation.regenerate_link` — real handler below. Reuses
 *   `QuotationService.sendQuotation()` unchanged (the same synchronous
 *   flow already used elsewhere to email a quotation link) rather than
 *   duplicating any of its token/email logic.
 * - `admin.outbox.replay` — removed entirely, producer and consumer both.
 *   It only ever wrapped a cheap, synchronous, idempotent DB operation
 *   (`OutboxService.replayMany`); `quotation-timeline.controller.ts`'s
 *   `requestReplay()` now calls that directly instead of round-tripping
 *   through this queue. No handler is registered for it here — nothing
 *   produces this event name anymore.
 * - `quotation.superseded` — still a placeholder, deliberately. Its
 *   business intent (should anything happen at all when a quotation
 *   version is superseded? notify staff? nothing?) could not be proven
 *   from the codebase — no code anywhere reacts to this event today, and
 *   the one plausible reading (notify staff) would require extending
 *   `NotificationModel`'s closed `type` enum, a schema change with no
 *   product sign-off yet. Left failing loudly (retry/backoff/dead-letter)
 *   rather than guessed at, per the E5-F1-T2 investigation.
 *
 * Split into two layers for testability, mirroring lib/health.ts and
 * lib/gracefulShutdown.ts: `processNextOutboxEvent`/`drainOutboxEvents`
 * are pure functions over injected dependencies (no Mongo/timer import),
 * unit-testable without a live database. `startOutboxWorker`/
 * `stopOutboxWorker` are the thin real-wiring layer (setInterval +
 * OutboxService + logger) registered alongside the existing scheduler
 * jobs in scheduler.service.ts.
 */
import { randomUUID } from 'crypto';
import type { IOutboxEvent } from '../models/outbox-event.model.js';
import { OutboxService } from './outbox.service.js';
import QuotationModel from '../models/quotation.model.js';
import { QuotationService } from './quotation.service.js';
import { logger } from '../lib/logger.js';
import { OUTBOX_POLL_INTERVAL_MS } from '../constants/timing.js';

export type OutboxEventHandler = (event: IOutboxEvent) => Promise<void>;

export type OutboxLogFn = (
    level: 'info' | 'warn' | 'error',
    event: string,
    meta: Record<string, unknown>,
) => void;

/** Upper bound on events claimed within a single poll tick, so one tick can never run unbounded. */
const MAX_EVENTS_PER_TICK = 10;

// ─── Handler registry ───────────────────────────────────────────────────────

const handlerRegistry = new Map<string, OutboxEventHandler>();

/** Registers (or replaces) the handler for a given Outbox `eventName`. */
export function registerOutboxHandler(eventName: string, handler: OutboxEventHandler): void {
    handlerRegistry.set(eventName, handler);
}

export function getRegisteredOutboxHandler(eventName: string): OutboxEventHandler | undefined {
    return handlerRegistry.get(eventName);
}

function placeholderHandler(eventName: string): OutboxEventHandler {
    return async () => {
        throw new Error(
            `Outbox event "${eventName}" has no business handler implemented yet ` +
                '(E5-F1-T2: business intent could not be proven from the existing codebase ' +
                'without guessing — see the E5-F1-T2 investigation). This failure is expected ' +
                'and will retry/dead-letter like any other handler failure until a real handler ' +
                'is registered.',
        );
    };
}

// `quotation.superseded` stays on the placeholder — see the module-level
// comment above for why (unproven business intent, would need a schema
// change to even guess at "notify staff").
registerOutboxHandler('quotation.superseded', placeholderHandler('quotation.superseded'));

/**
 * `admin.quotation.regenerate_link` real handler (Phase 1b).
 *
 * Reuses `QuotationService.sendQuotation()` verbatim — the same
 * synchronous flow that already generates a fresh `secureToken`/
 * `tokenExpiresAt` when needed and emails the quotation PDF/link to the
 * client (`quotation.service.ts`'s `sendQuotation`, ~L416). No token
 * generation, email rendering, or recipient-resolution logic is
 * duplicated here — this handler's only job is resolving the event's
 * `quotationGroupId` payload into the concrete quotation `_id` that
 * `sendQuotation()` expects (the same `{ quotationGroupId,
 * isLatestVersion: true }` lookup `createNewVersion()` already performs).
 */
async function handleAdminQuotationRegenerateLink(event: IOutboxEvent): Promise<void> {
    const payload = (event.payload ?? {}) as { quotationGroupId?: unknown; actorUserId?: unknown };
    const quotationGroupId =
        typeof payload.quotationGroupId === 'string' ? payload.quotationGroupId : undefined;

    if (!quotationGroupId) {
        throw new Error(
            `admin.quotation.regenerate_link event ${String(event._id)} is missing a valid "quotationGroupId" in its payload`,
        );
    }

    const latest = await QuotationModel.findOne({ quotationGroupId, isLatestVersion: true });
    if (!latest) {
        throw new Error(
            `admin.quotation.regenerate_link: no latest quotation found for quotationGroupId "${quotationGroupId}"`,
        );
    }

    const actorUserId = typeof payload.actorUserId === 'string' ? payload.actorUserId : '';
    await QuotationService.sendQuotation(latest._id.toString(), actorUserId);
}

registerOutboxHandler('admin.quotation.regenerate_link', handleAdminQuotationRegenerateLink);

// `admin.outbox.replay` is intentionally NOT registered here — it has
// been removed as an Outbox event entirely (Phase 1b). It only ever
// wrapped a cheap, synchronous, idempotent DB operation
// (`OutboxService.replayMany`); `quotation-timeline.controller.ts` now
// calls that directly instead of producing this event. Nothing enqueues
// it anymore, so no handler is needed.

// ─── Pure core: claim → dispatch → mark (injectable, unit-testable) ────────

export interface OutboxWorkerDeps {
    claimNext: (lockId: string) => Promise<IOutboxEvent | null>;
    markProcessed: (id: string, lockId: string) => Promise<void>;
    markFailed: (id: string, lockId: string, errorMessage: string) => Promise<void>;
    getHandler: (eventName: string) => OutboxEventHandler | undefined;
    onLog?: OutboxLogFn;
}

/**
 * Claims and processes at most one Outbox event.
 * Returns `true` if an event was claimed (regardless of handler
 * success/failure), `false` if the queue had nothing claimable — the
 * caller uses this to decide whether to keep draining within a tick.
 */
export async function processNextOutboxEvent(lockId: string, deps: OutboxWorkerDeps): Promise<boolean> {
    const event = await deps.claimNext(lockId);
    if (!event) return false;

    const log = deps.onLog ?? (() => {});
    const eventId = String(event._id);
    const handler = deps.getHandler(event.eventName);

    try {
        if (!handler) {
            throw new Error(`No handler registered for Outbox event type "${event.eventName}"`);
        }
        await handler(event);
        await deps.markProcessed(eventId, lockId);
        log('info', 'outbox.worker.event_processed', { eventId, eventName: event.eventName });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log('error', 'outbox.worker.event_failed', { eventId, eventName: event.eventName, error: message });
        await deps.markFailed(eventId, lockId, message);
    }

    return true;
}

/**
 * Drains up to `maxEvents` claimable events in sequence. Stops early if
 * the queue is exhausted, or if `shouldStop()` reports true between
 * claims (used to cut a tick short during graceful shutdown without
 * abandoning whatever single claim is already in flight).
 */
export async function drainOutboxEvents(
    lockId: string,
    deps: OutboxWorkerDeps,
    maxEvents: number,
    shouldStop: () => boolean = () => false,
): Promise<number> {
    let processedCount = 0;
    while (processedCount < maxEvents) {
        if (shouldStop()) break;
        const claimed = await processNextOutboxEvent(lockId, deps);
        if (!claimed) break;
        processedCount++;
    }
    return processedCount;
}

// ─── Real wiring: setInterval + OutboxService + logger ─────────────────────

const WORKER_ID = `outbox-worker:${process.pid}:${randomUUID()}`;

let pollInterval: ReturnType<typeof setInterval> | null = null;
let tickInFlight: Promise<void> | null = null;
let stopRequested = false;

function realDeps(): OutboxWorkerDeps {
    return {
        claimNext: (lockId) => OutboxService.claimNext(lockId),
        markProcessed: (id, lockId) => OutboxService.markProcessed(id, lockId),
        markFailed: (id, lockId, message) => OutboxService.markFailed(id, lockId, message),
        getHandler: getRegisteredOutboxHandler,
        onLog: (level, event, meta) => logger[level](meta, event),
    };
}

async function runTick(): Promise<void> {
    try {
        await drainOutboxEvents(WORKER_ID, realDeps(), MAX_EVENTS_PER_TICK, () => stopRequested);
    } catch (err: unknown) {
        logger.error(
            { workerId: WORKER_ID, err: err instanceof Error ? err.message : String(err) },
            'outbox.worker.tick_failed',
        );
    }
}

/** Starts the poll loop. Idempotent — calling it while already running is a no-op. */
export function startOutboxWorker(): void {
    if (pollInterval) return;
    stopRequested = false;

    const scheduleTick = () => {
        tickInFlight = runTick().finally(() => {
            tickInFlight = null;
        });
    };

    scheduleTick();
    pollInterval = setInterval(scheduleTick, OUTBOX_POLL_INTERVAL_MS);
    logger.info({ workerId: WORKER_ID, pollIntervalMs: OUTBOX_POLL_INTERVAL_MS }, 'outbox.worker.started');
}

/**
 * Stops the poll loop and awaits whatever tick is currently in flight, so
 * shutdown doesn't abandon a claim mid-processing. Bounded implicitly by
 * the outer graceful-shutdown timeout (createGracefulShutdown's own
 * `timeoutMs`) — if the in-flight tick doesn't finish in time, the process
 * exits anyway rather than hanging, same as every other resource closed
 * during shutdown.
 */
export async function stopOutboxWorker(): Promise<void> {
    stopRequested = true;
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    if (tickInFlight) {
        await tickInFlight;
    }
    logger.info({ workerId: WORKER_ID }, 'outbox.worker.stopped');
}
