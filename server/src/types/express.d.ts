import 'express';

declare module 'express-serve-static-core' {
    interface Request {
        correlationId?: string;
        requestId?: string;
        user?: {
            id?: string;
            role?: string;
            name?: string;
            email?: string;
        };
    }
}


import type { User } from 'better-auth';

declare global {
    namespace Express {
        interface Request {
            user?: User & {
                role: string;
            };
        }
    }
}
