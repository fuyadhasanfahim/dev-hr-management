import pino from 'pino';
import { getRequestContext } from './requestContext.js';

type LogContext = {
    correlationId?: string;
    requestId?: string;
    actorUserId?: string;
};

function currentLogContext(): LogContext {
    const ctx = getRequestContext();
    if (!ctx) return {};
    return {
        correlationId: ctx.correlationId,
        requestId: ctx.requestId,
        ...(ctx.actorUserId ? { actorUserId: ctx.actorUserId } : {}),
    };
}

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: null,
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["stripe-signature"]',
            'req.body',
        ],
        remove: true,
    },
    mixin() {
        return currentLogContext();
    },
});

