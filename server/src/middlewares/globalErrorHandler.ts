import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';
import { captureException } from '../lib/sentry.js';

export const globalErrorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            success: false,
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack,
        });
    } else {
        // Production
        if (err instanceof AppError && err.isOperational) {
            res.status(err.statusCode).json({
                success: false,
                status: err.status,
                message: err.message,
            });
        } else {
            logger.error(
                {
                    err,
                    http: {
                        method: req.method,
                        path: req.originalUrl,
                    },
                },
                'http.error',
            );
            captureException(err, {
                method: req.method,
                path: req.originalUrl,
            });
            res.status(500).json({
                success: false,
                status: 'error',
                message: 'Something went very wrong!',
            });
        }
    }
};
