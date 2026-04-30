import type { Request, Response, NextFunction } from 'express';
import { auth } from '../lib/auth.js';
import { AppError } from '../utils/AppError.js';

export async function requireAuth(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    try {
        // 1. Extract token from Authorization header (Bearer token)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            // Better-auth looks for cookies by default, so we ensure the session token is present
            if (!req.headers.cookie || !req.headers.cookie.includes('better-auth.session_token')) {
                const sessionCookie = `better-auth.session_token=${token}`;
                req.headers.cookie = req.headers.cookie 
                    ? `${req.headers.cookie}; ${sessionCookie}` 
                    : sessionCookie;
            }
        }

        const session = await auth.api.getSession({
            headers: req.headers,
        });

        if (!session || !session.user) {
            console.warn(`[Auth] Unauthorized access attempt to ${req.originalUrl}`);
            return next(new AppError('Unauthorized. Please login.', 401));
        }

        req.user = {
            ...session.user,
            role: (session.user.role as string) || 'staff',
        };

        next();
    } catch (error: any) {
        console.error('[Auth Error]:', error.message);
        return next(new AppError('Authentication failed.', 401));
    }
}

export function restrictTo(...roles: string[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role as string)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }

        next();
    };
}
