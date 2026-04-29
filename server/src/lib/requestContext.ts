import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

export type RequestContext = Readonly<{
    correlationId: string;
    requestId: string;
    actorUserId?: string;
}>;

type MutableRequestContext = {
    correlationId: string;
    requestId: string;
    actorUserId?: string;
};

const als = new AsyncLocalStorage<MutableRequestContext>();

export function createCorrelationId() {
    return crypto.randomUUID();
}

export function createRequestId() {
    return crypto.randomUUID();
}

export function runWithRequestContext<T>(
    ctx: RequestContext,
    fn: () => T,
): T {
    return als.run({ ...ctx }, fn);
}

export function getRequestContext(): RequestContext | undefined {
    return als.getStore();
}

export function getCorrelationId(): string | undefined {
    return als.getStore()?.correlationId;
}

export function getRequestId(): string | undefined {
    return als.getStore()?.requestId;
}

export function setActorUserId(actorUserId: string | undefined) {
    const store = als.getStore();
    if (!store) return;
    if (!actorUserId) {
        delete store.actorUserId;
        return;
    }
    store.actorUserId = actorUserId;
}

