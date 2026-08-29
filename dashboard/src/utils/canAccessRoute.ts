import { Role } from '@/constants/role';
import { sidebarData } from '@/constants/sidebar';
import { canAccess } from './canAccess';

/**
 * Phase 4 — route-level access check that prefers the permission gate.
 *
 * If the best-matching sidebar entry for `pathname` declares a `permission`,
 * that decides. Otherwise we fall back to the legacy role map in
 * {@link canAccess} (which also covers `blockedRoute`).
 */
export function canAccessRoute(
    pathname: string,
    role: Role | undefined,
    can: (needed: string | string[]) => boolean,
): boolean {
    const match = [...sidebarData]
        .filter((item) => !item.external)
        .sort((a, b) => b.url.length - a.url.length)
        .find(
            (item) =>
                pathname === item.url || pathname.startsWith(item.url + '/'),
        );

    if (match?.permission) {
        return can(match.permission);
    }

    if (!role) return false;
    return canAccess(role, pathname);
}
