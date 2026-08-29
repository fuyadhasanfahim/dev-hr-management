/**
 * Phase 3 — permission-based route guards.
 *
 * These replace the role-name checks in `authorize(...)` / `restrictTo(...)`.
 * They read `req.user.permissions`, which `requireAuth` resolves once per
 * request (Phase 2), so there is no extra DB hit here.
 *
 *   router.post('/', requireAuth, requirePermission('order.create'), ctrl.create);
 *   router.get('/reports', requireAuth, requireAnyPermission('order.read', 'analytics.read'), ctrl.reports);
 *
 * `super_admin` holds `['*']`, which satisfies every check.
 */
import type { Request, Response, NextFunction } from 'express';
import { hasPermission } from '../lib/permissions.js';

function deny(res: Response, needed: readonly string[]) {
    return res.status(403).json({
        success: false,
        message: `Forbidden: missing permission (${needed.join(' or ')})`,
    });
}

function ensureAuthed(req: Request, res: Response): boolean {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return false;
    }
    return true;
}

/** Require EVERY listed permission. */
export const requirePermission =
    (...needed: string[]) =>
    (req: Request, res: Response, next: NextFunction) => {
        if (!ensureAuthed(req, res)) return;
        const perms = req.user!.permissions;
        const ok = needed.every((n) => hasPermission(perms, n));
        if (!ok) return deny(res, needed);
        return next();
    };

/** Require AT LEAST ONE of the listed permissions. */
export const requireAnyPermission =
    (...needed: string[]) =>
    (req: Request, res: Response, next: NextFunction) => {
        if (!ensureAuthed(req, res)) return;
        const perms = req.user!.permissions;
        const ok = needed.some((n) => hasPermission(perms, n));
        if (!ok) return deny(res, needed);
        return next();
    };

/** Handy inside controllers for conditional logic / field-level checks. */
export function userCan(req: Request, needed: string): boolean {
    return hasPermission(req.user?.permissions, needed);
}
