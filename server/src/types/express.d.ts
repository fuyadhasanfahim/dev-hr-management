import 'express';
import type { ResolvedPaymentToken } from '../services/payment.service.js';

declare module 'express-serve-static-core' {
    interface Request {
        correlationId?: string;
        requestId?: string;
        /** Set by resolvePaymentToken — the server-trusted result of validating the request's payment token. */
        paymentCtx?: ResolvedPaymentToken;
        user?: {
            id?: string;
            role?: string;
            name?: string;
            email?: string;
            /** Phase 1 — per-user permission overrides (see auth.ts additionalFields). */
            extraPermissions?: string[];
            deniedPermissions?: string[];
            /**
             * Effective permission keys for the request user, resolved from
             * the user's role + per-user overrides. Populated by the auth
             * middleware in Phase 2; consumed by `requirePermission` in
             * Phase 3.
             */
            permissions?: string[];
        };
    }
}


import type { User } from 'better-auth';

declare global {
    namespace Express {
        interface Request {
            user?: User & {
                role: string;
                /** Phase 1 — per-user permission overrides (see auth.ts additionalFields). */
                extraPermissions?: string[];
                deniedPermissions?: string[];
                /** Phase 2 — effective, fully-resolved permission keys for this request. */
                permissions?: string[];
            };
        }
    }
}
