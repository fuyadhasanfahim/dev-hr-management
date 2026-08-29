'use client';

import { useMemo } from 'react';
import { useGetMyPermissionsQuery } from '@/redux/features/me/meApi';

const WILDCARD_ALL = '*';

export interface UsePermissionsResult {
    /** Resolved permission keys for the current user (`["*"]` = superuser). */
    permissions: string[];
    role: string | null;
    isSuperuser: boolean;
    /** True only if the user holds every permission in `needed`. */
    can: (needed: string | string[]) => boolean;
    /** True if the user holds at least one permission in `needed`. */
    canAny: (needed: string[]) => boolean;
    isLoading: boolean;
    isError: boolean;
}

/**
 * Phase 4 — read the current user's effective permissions (from
 * `GET /api/me/permissions`) and check them.
 *
 *   const { can } = usePermissions();
 *   {can('order.create') && <NewOrderButton />}
 *
 * This is UX only — the API enforces the real check (Phase 3). While the
 * query is in flight `can()` returns false, so gated UI stays hidden until
 * permissions are known.
 */
export function usePermissions(): UsePermissionsResult {
    const { data, isLoading, isFetching, isError } = useGetMyPermissionsQuery();

    return useMemo(() => {
        const permissions = data?.permissions ?? [];
        const isSuperuser = permissions.includes(WILDCARD_ALL);
        const set = new Set(permissions);

        const can = (needed: string | string[]) => {
            if (isSuperuser) return true;
            const list = Array.isArray(needed) ? needed : [needed];
            return list.length > 0 && list.every((n) => set.has(n));
        };

        const canAny = (needed: string[]) => {
            if (isSuperuser) return true;
            return needed.some((n) => set.has(n));
        };

        return {
            permissions,
            role: data?.role ?? null,
            isSuperuser,
            can,
            canAny,
            isLoading: isLoading || isFetching,
            isError,
        };
    }, [data, isLoading, isFetching, isError]);
}

/** Convenience: boolean check for a single permission or an all-of list. */
export function usePermission(needed: string | string[]): boolean {
    return usePermissions().can(needed);
}
