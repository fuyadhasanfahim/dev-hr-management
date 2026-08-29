/**
 * Permission resolver (Phase 2, layered in Phase 6).
 *
 * A user's effective permissions are the union of four grant sources minus
 * their personal deny list:
 *
 *   effective = ( role.permissions
 *               ∪ department.permissions   (the user's staff department)
 *               ∪ designation.permissions  (the user's staff designation)
 *               ∪ user.extraPermissions )  (person-wise override)
 *             − user.deniedPermissions
 *
 * `super_admin` (any grant holding the `*` wildcard) short-circuits to
 * `['*']`, which {@link hasPermission} treats as "allow everything".
 *
 * Grant lookups are cached in-process for a few minutes. Call the
 * `invalidate*` helpers after editing a role / department / designation.
 */

import RoleModel from '../models/role.model.js';
import DepartmentModel from '../models/department.model.js';
import DesignationModel from '../models/designation.model.js';
import StaffModel from '../models/staff.model.js';
import { escapeRegex } from './sanitize.js';
import { logger } from './logger.js';
import {
    PERMISSION_GROUPS,
    WILDCARD_ALL,
    type PermissionGroup,
} from '../constants/permission.js';
import { SYSTEM_ROLE_PERMISSIONS } from '../constants/role-permission.js';

const SYSTEM_FALLBACK: Record<string, readonly string[]> = SYSTEM_ROLE_PERMISSIONS;

// --------------------------------------------------------------------------
// grant caches
// --------------------------------------------------------------------------

const GRANT_TTL_MS = 5 * 60 * 1000;
/** Staff dept/designation changes rarely — a short TTL is enough, no explicit bust. */
const SCOPE_TTL_MS = 2 * 60 * 1000;

interface GrantEntry {
    permissions: string[];
    expiresAt: number;
}
interface ScopeEntry {
    department?: string;
    designation?: string;
    expiresAt: number;
}

const roleCache = new Map<string, GrantEntry>();
const departmentCache = new Map<string, GrantEntry>();
const designationCache = new Map<string, GrantEntry>();
const userScopeCache = new Map<string, ScopeEntry>();

/** Drop one role (by slug) or the whole role cache. Call after a role edit. */
export function invalidateRoleCache(slug?: string): void {
    if (slug) roleCache.delete(slug.toLowerCase());
    else roleCache.clear();
}
/** Drop one department's cached grant (by name/code) or all of them. */
export function invalidateDepartmentCache(key?: string): void {
    if (key) departmentCache.delete(key.trim().toLowerCase());
    else departmentCache.clear();
}
/** Drop one designation's cached grant (by name/code) or all of them. */
export function invalidateDesignationCache(key?: string): void {
    if (key) designationCache.delete(key.trim().toLowerCase());
    else designationCache.clear();
}
/** Drop a user's cached department/designation lookup. */
export function invalidateUserScope(userId?: string): void {
    if (userId) userScopeCache.delete(userId);
    else userScopeCache.clear();
}

async function loadRoleGrants(slug: string): Promise<string[]> {
    const key = slug.toLowerCase();
    const hit = roleCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.permissions;

    const role = await RoleModel.findOne({ slug: key, isActive: true })
        .select('permissions')
        .lean<{ permissions: string[] } | null>();

    // Fall back to the built-in defaults when the DB has no row yet.
    const permissions = role?.permissions ?? SYSTEM_FALLBACK[key]?.slice() ?? [];
    roleCache.set(key, { permissions, expiresAt: Date.now() + GRANT_TTL_MS });
    return permissions;
}

async function loadNamedGrants(
    cache: Map<string, GrantEntry>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: any,
    rawValue: string,
): Promise<string[]> {
    const key = rawValue.trim().toLowerCase();
    if (!key) return [];
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.permissions;

    const doc = await model
        .findOne({
            isActive: true,
            $or: [
                { code: key },
                { name: { $regex: `^${escapeRegex(key)}$`, $options: 'i' } },
            ],
        })
        .select('permissions')
        .lean();

    const permissions: string[] = doc?.permissions ?? [];
    cache.set(key, { permissions, expiresAt: Date.now() + GRANT_TTL_MS });
    return permissions;
}

async function loadUserScope(userId: string): Promise<ScopeEntry> {
    const hit = userScopeCache.get(userId);
    if (hit && hit.expiresAt > Date.now()) return hit;

    let staff: { department?: string; designation?: string } | null = null;
    try {
        staff = await StaffModel.findOne({ userId })
            .select('department designation')
            .lean<{ department?: string; designation?: string } | null>();
    } catch {
        staff = null;
    }

    const entry: ScopeEntry = {
        department: staff?.department,
        designation: staff?.designation,
        expiresAt: Date.now() + SCOPE_TTL_MS,
    };
    userScopeCache.set(userId, entry);
    return entry;
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
 * Pure form of {@link getEffectivePermissions} — takes the already-merged
 * grant list (role ∪ department ∪ designation ∪ extra) instead of hitting
 * the DB.
 */
export function resolvePermissions(
    grantedPermissions: readonly string[],
    extraPermissions: readonly string[] = [],
    deniedPermissions: readonly string[] = [],
): string[] {
    const merged = expandWildcards([...grantedPermissions, ...extraPermissions]);
    if (merged[0] === WILDCARD_ALL) return [WILDCARD_ALL];

    if (deniedPermissions.length === 0) return merged;
    const denied = new Set(deniedPermissions);
    return merged.filter((p) => !denied.has(p));
}

// --------------------------------------------------------------------------
// public API
// --------------------------------------------------------------------------

export interface PermissionUser {
    /** Better Auth user id — used to look up the staff dept/designation grants. */
    userId?: string | null;
    role?: string | null;
    /** Pre-known department/designation (skips the staff lookup when provided). */
    department?: string | null;
    designation?: string | null;
    extraPermissions?: string[] | null;
    deniedPermissions?: string[] | null;
}

/**
 * Fully-resolved permission list for a user. Returns `['*']` for a
 * superuser. Never throws — on a DB error it falls back to the built-in
 * defaults for the user's role.
 */
export async function getEffectivePermissions(
    user: PermissionUser,
): Promise<string[]> {
    const extra = user.extraPermissions ?? [];
    const denied = user.deniedPermissions ?? [];

    try {
        const granted: string[] = [];

        if (user.role) granted.push(...(await loadRoleGrants(user.role)));

        // department / designation: use what the caller passed, else look up
        // the staff record by userId.
        let department = user.department ?? undefined;
        let designation = user.designation ?? undefined;
        if ((department === undefined || designation === undefined) && user.userId) {
            const scope = await loadUserScope(user.userId);
            department = department ?? scope.department;
            designation = designation ?? scope.designation;
        }

        if (department) {
            granted.push(
                ...(await loadNamedGrants(departmentCache, DepartmentModel, department)),
            );
        }
        if (designation) {
            granted.push(
                ...(await loadNamedGrants(designationCache, DesignationModel, designation)),
            );
        }

        return resolvePermissions(granted, extra, denied);
    } catch (err) {
        logger.error(
            { err },
            `[permissions] grant lookup failed for role "${user.role}", using built-in defaults`,
        );
        return resolvePermissions(
            user.role ? (SYSTEM_FALLBACK[user.role] ?? []) : [],
            extra,
            denied,
        );
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
