import * as Sentry from '@sentry/node';
import { getRequestContext } from './requestContext.js';

let enabled = false;

export function initSentry() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return;

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        release: process.env.SENTRY_RELEASE,
        tracesSampleRate: 0,
    });

    enabled = true;
}

export function isSentryEnabled() {
    return enabled;
}

export function captureException(err: unknown, extra?: Record<string, unknown>) {
    if (!enabled) return;
    const ctx = getRequestContext();
    Sentry.withScope((scope) => {
        if (ctx?.correlationId) scope.setTag('correlationId', ctx.correlationId);
        if (ctx?.requestId) scope.setTag('requestId', ctx.requestId);
        if (ctx?.actorUserId) scope.setUser({ id: ctx.actorUserId });
        if (extra) scope.setContext('extra', extra);
        Sentry.captureException(err);
    });
}

export function captureMessage(
    message: string,
    opts?: { level?: Sentry.SeverityLevel; tags?: Record<string, string>; extra?: Record<string, unknown> },
) {
    if (!enabled) return;
    const ctx = getRequestContext();
    Sentry.withScope((scope) => {
        if (opts?.level) scope.setLevel(opts.level);
        if (opts?.tags) {
            for (const [k, v] of Object.entries(opts.tags)) scope.setTag(k, v);
        }
        if (ctx?.correlationId) scope.setTag('correlationId', ctx.correlationId);
        if (ctx?.requestId) scope.setTag('requestId', ctx.requestId);
        if (opts?.extra) scope.setContext('extra', opts.extra);
        Sentry.captureMessage(message);
    });
}

