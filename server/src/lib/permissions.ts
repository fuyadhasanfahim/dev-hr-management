/**
 * Phase 2 — permission resolver.
 *
 * Turns a user's role + per-user overrides into a concrete, wildcard-free
 * permission list:
 *
 *   effective = (role.permissions ∪ extraPermissions) − deniedPermissions
 *
 * `super_admin` (or any role holding the `*` wildcard) short-circuits to
 * `['*']`, which {@link hasPermission} treats as "allow everything".
 *
 * Role → permission lookups are cached in-process for a few minutes; call
 * {@link invalidateRoleCache} after editing a role (Phase 5).
 */

import RoleModel from '../models/role.model.js';
import { logger } from './logger.js';
import {
    PERMISSION_GROUPS,
    WILDCARD_ALL,
    type PermissionGroup,
} from '../constants/permission.js';
import { SYSTEM_ROLE_PERMISSIONS } from '../constants/role-permission.js';

const SYSTEM_FALLBACK: Record<string, readonly string[]> = SYSTEM_ROLE_PERMISSIONS;

// --------------------------------------------------------------------------
// role -> permissions cache
// --------------------------------------------------------------------------

const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
    permissions: string[];
    expiresAt: number;
}

const roleCache = new Map<string, CacheEntry>();

/** Drop one role (by slug) or the whole cache. Call after a role is edited. */
export function invalidateRoleCache(slug?: string): void {
    if (slug) roleCache.delete(slug);
    else roleCache.clear();
}

async function loadRolePermissions(slug: string): Promise<string[]> {
    const now = Date.now();
    const hit = roleCache.get(slug);
    if (hit && hit.expiresAt > now) return hit.permissions;

    const role = await RoleModel.findOne({ slug, isActive: true })
        .select('permissions')
        .lean<{ permissions: string[] } | null>();

    // Fall back to the built-in defaults when the DB has no row yet (e.g.
    // `seed:roles` hasn't run) so behaviour is preserved out of the box.
    const permissions = role?.permissions ?? SYSTEM_FALLBACK[slug]?.slice() ?? [];

    roleCache.set(slug, { permissions, expiresAt: now + ROLE_CACHE_TTL_MS });
    return permissions;
}

// --------------------------------------------------------------------------
// pure resolution (no DB — unit-testable)
// --------------------------------------------------------------------------

/**
 * Expand `resource.*` entries against the catalog. A bare `*` short-circuits
 * the whole list to `['*']`.
 */
function expandWildcards(perms: Iterable<string>): string[] {
    const out = new Set<string>();
    for (const p of perms) {
        if (p === WILDCARD_ALL) return [WILDCARD_ALL];
        if (p.endsWith('.*')) {
            const resource = p.slice(0, -2) as PermissionGroup;
            const group = PERMISSION_GROUPS[resource];
            if (group) {
                for (const action of group.actions) out.add(`${resource}.${action}`);
            }
            continue;
        }
        out.add(p);
    }
    return [...out];
}

/**
 * Pure form of {@link getEffectivePermissions} — takes the already-loaded
 * role permission list instead of hitting the DB.
 */
export function resolvePermissions(
    rolePermissions: readonly string[],
    extraPermissions: readonly string[] = [],
    deniedPermissions: readonly string[] = [],
): string[] {
    const merged = expandWildcards([...rolePermissions, ...extraPermissions]);
    if (merged[0] === WILDCARD_ALL) return [WILDCARD_ALL];

    if (deniedPermissions.length === 0) return merged;
    const denied = new Set(deniedPermissions);
    return merged.filter((p) => !denied.has(p));
}

// --------------------------------------------------------------------------
// public API
// --------------------------------------------------------------------------

export interface PermissionUser {
    role?: string | null;
    extraPermissions?: string[] | null;
    deniedPermissions?: string[] | null;
}

/**
 * Fully-resolved permission list for a user. Returns `['*']` for a
 * superuser. Never throws — on a DB error it falls back to the built-in
 * defaults for the user's role so system roles keep working.
 */
export async function getEffectivePermissions(user: PermissionUser): Promise<string[]> {
    const extra = user.extraPermissions ?? [];
    const denied = user.deniedPermissions ?? [];

    if (!user.role) return resolvePermissions([], extra, denied);

    try {
        const rolePerms = await loadRolePermissions(user.role);
        return resolvePermissions(rolePerms, extra, denied);
    } catch (err) {
        logger.error(
            { err },
            `[permissions] role lookup failed for "${user.role}", using built-in defaults`,
        );
        return resolvePermissions(SYSTEM_FALLBACK[user.role] ?? [], extra, denied);
    }
}

/** Cheap membership check used by route guards. `*` grants everything. */
export function hasPermission(
    perms: readonly string[] | undefined | null,
    needed: string,
): boolean {
    if (!perms || perms.length === 0) return false;
    return perms.includes(WILDCARD_ALL) || perms.includes(needed);
}

/** True only if every entry in `needed` is held. */
export function hasAllPermissions(
    perms: readonly string[] | undefined | null,
    needed: readonly string[],
): boolean {
    return needed.every((n) => hasPermission(perms, n));
}

/** True if at least one entry in `needed` is held. */
export function hasAnyPermission(
    perms: readonly string[] | undefined | null,
    needed: readonly string[],
): boolean {
    return needed.some((n) => hasPermission(perms, n));
}
