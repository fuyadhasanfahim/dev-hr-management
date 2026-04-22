import type { Request, Response, NextFunction } from 'express';
import { auth } from '../lib/auth.js';
import { AppError } from '../utils/AppError.js';

export async function requireAuth(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    try {
        const session = await auth.api.getSession({
            headers: req.headers,
        });

        if (!session || !session.user || !session.user.role) {
            return next(new AppError('Unauthorized. Please login.', 401));
        }

        req.user = {
            ...session.user,
            role: session.user.role as string,
        };

        next();
    } catch (error) {
        return next(new AppError('Invalid or expired token.', 401));
    }
}

export function restrictTo(...roles: string[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
}
