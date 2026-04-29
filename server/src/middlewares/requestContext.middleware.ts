import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import {
    createCorrelationId,
    createRequestId,
    runWithRequestContext,
    setActorUserId,
} from '../lib/requestContext.js';

function getHeaderValue(req: Request, headerName: string): string | undefined {
    const raw = req.header(headerName);
    if (!raw) return undefined;
    const value = String(raw).trim();
    return value.length ? value : undefined;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    const correlationId = getHeaderValue(req, 'x-correlation-id') ?? createCorrelationId();
    const requestId = createRequestId();

    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-request-id', requestId);

    runWithRequestContext(
        {
            correlationId,
            requestId,
            ...(req.user?.id ? { actorUserId: req.user.id } : {}),
        },
        () => {
            setActorUserId(req.user?.id);

            (req as any).correlationId = correlationId;
            (req as any).requestId = requestId;

            res.on('finish', () => {
                const durationMs = Date.now() - start;
                logger.info(
                    {
                        http: {
                            method: req.method,
                            path: req.originalUrl,
                            statusCode: res.statusCode,
                            durationMs,
                        },
                    },
                    'http.request',
                );
            });

            next();
        },
    );
}

