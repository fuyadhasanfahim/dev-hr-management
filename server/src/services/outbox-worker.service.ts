/**
 * E5-F1-T2 Phase 1 — Outbox worker infrastructure only.
 *
 * This module is the first thing that ever calls `OutboxService.claimNext`/
 * `markProcessed`/`markFailed` (confirmed via full-tree grep during the
 * E5-F1-T2 design pass: those three methods previously had zero callers —
 * every enqueued event has sat in `pending` since the Outbox pattern was
 * introduced). It provides the claim → dispatch → mark-processed/failed
 * loop and a name-based handler registry; it deliberately does NOT
 * implement any business behavior for the event types currently produced
 * (`quotation.superseded`, `admin.quotation.regenerate_link`,
 * `admin.outbox.replay`) — each is registered with a placeholder handler
 * that fails loudly (visible via the admin `/outbox` UI, retried with the
 * existing backoff, eventually dead-lettered) rather than silently
 * marking real business events "processed" with no effect. Wiring real
 * handlers is explicitly out of scope for this phase.
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
                '(E5-F1-T2 Phase 1 shipped worker infrastructure only — the business action ' +
                'is a separate, not-yet-approved phase). This failure is expected and will ' +
                'retry/dead-letter like any other handler failure until a real handler is registered.',
        );
    };
}

// Placeholder registrations for every event type currently produced
// (traced exhaustively during the E5-F1-T2 design pass — see that
// proposal for the full producer audit). Registering explicit
// placeholders, rather than leaving these names unregistered, keeps the
// dispatch path exercised end-to-end for all three today, and documents
// intent per event type rather than relying on the generic
// "no handler registered" fallback below.
registerOutboxHandler('quotation.superseded', placeholderHandler('quotation.superseded'));
registerOutboxHandler('admin.quotation.regenerate_link', placeholderHandler('admin.quotation.regenerate_link'));
registerOutboxHandler('admin.outbox.replay', placeholderHandler('admin.outbox.replay'));

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
