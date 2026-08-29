'use client';

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

interface CanProps {
    /** Require every permission in this list (string or string[]). */
    permission?: string | string[];
    /** Require at least one permission in this list. */
    any?: string[];
    /** Rendered instead of `children` when the check fails. */
    fallback?: ReactNode;
    /** Rendered while permissions are still loading (default: nothing). */
    loading?: ReactNode;
    children: ReactNode;
}

/**
 * Phase 4 — conditionally render UI based on the current user's permissions.
 *
 *   <Can permission="staff.create"><InviteButton /></Can>
 *   <Can any={['order.update', 'order.delete']}><RowActions /></Can>
 *
 * With neither `permission` nor `any`, always renders `children`.
 */
export function Can({ permission, any, fallback = null, loading = null, children }: CanProps) {
    const { can, canAny, isLoading } = usePermissions();

    if (isLoading) return <>{loading}</>;

    const allowed = any
        ? canAny(any)
        : permission
          ? can(permission)
          : true;

    return <>{allowed ? children : fallback}</>;
}
