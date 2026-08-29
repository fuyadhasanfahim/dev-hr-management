import { Router, type Request, type Response } from 'express';
import { getEffectivePermissions } from '../lib/permissions.js';

const router: Router = Router();

/**
 * Phase 2 — GET /api/me/permissions
 *
 * The frontend calls this once after sign-in to learn what the current user
 * can do, then gates menus / routes / buttons on the result. `requireAuth`
 * (the /api gate in app.ts) has already populated `req.user.permissions`;
 * we recompute as a defensive fallback only if it is somehow missing.
 *
 * Returns `["*"]` for a superuser.
 */
router.get('/permissions', async (req: Request, res: Response) => {
    const permissions =
        req.user?.permissions ??
        (await getEffectivePermissions({
            userId: req.user?.id,
            role: req.user?.role,
            extraPermissions: req.user?.extraPermissions,
            deniedPermissions: req.user?.deniedPermissions,
        }));

    res.json({
        success: true,
        data: {
            role: req.user?.role ?? null,
            permissions,
        },
    });
});

export const meRoute = router;
