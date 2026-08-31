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
import getRedisClient from './redis.js';
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

// --------------------------------------------------------------------------
// cross-instance cache invalidation (Redis pub/sub)
//
// The grant caches above live in-process. With more than one server
// instance, an admin editing a role / department / designation on instance A
// would leave instance B serving stale permissions until its TTL lapses
// (up to 5 min). We fan every local invalidation out over a Redis channel so
// all instances drop the same key. Redis being unavailable is non-fatal —
// we simply fall back to local-only invalidation + TTL.
// --------------------------------------------------------------------------

const RBAC_INVALIDATION_CHANNEL = 'rbac:cache:invalidate';

type InvalidationKind = 'role' | 'department' | 'designation' | 'userScope';
interface InvalidationMsg {
    kind: InvalidationKind;
    key?: string;
    /** Random per-process id so we can ignore our own echo. */
    origin: string;
}

const INVALIDATION_ORIGIN = Math.random().toString(36).slice(2);

function applyLocalInvalidation(kind: InvalidationKind, key?: string): void {
    switch (kind) {
        case 'role':
            if (key) roleCache.delete(key.toLowerCase());
            else roleCache.clear();
            break;
        case 'department':
            if (key) departmentCache.delete(key.trim().toLowerCase());
            else departmentCache.clear();
            break;
        case 'designation':
            if (key) designationCache.delete(key.trim().toLowerCase());
            else designationCache.clear();
            break;
        case 'userScope':
            if (key) userScopeCache.delete(key);
            else userScopeCache.clear();
            break;
    }
}

function publishInvalidation(kind: InvalidationKind, key?: string): void {
    try {
        const payload: InvalidationMsg = { kind, key, origin: INVALIDATION_ORIGIN };
        void getRedisClient().publish(
            RBAC_INVALIDATION_CHANNEL,
            JSON.stringify(payload),
        );
    } catch (err) {
        logger.warn({ err }, '[permissions] cache-invalidation publish failed');
    }
}

let invalidationSubscriberStarted = false;

/**
 * Wire up cross-instance grant-cache invalidation over Redis pub/sub.
 * Call once from the server bootstrap. Idempotent, and safe to skip
 * entirely (unit tests do) — invalidation then falls back to local +
 * TTL only. Never throws.
 */
export function initPermissionCacheSync(): void {
    if (invalidationSubscriberStarted) return;
    invalidationSubscriberStarted = true;
    try {
        const subscriber = getRedisClient().duplicate();
        subscriber.on('error', (err) => {
            logger.warn({ err }, '[permissions] invalidation subscriber error');
        });
        subscriber.subscribe(RBAC_INVALIDATION_CHANNEL).catch((err) => {
            logger.warn(
                { err },
                '[permissions] could not subscribe to RBAC invalidation channel; running local-only',
            );
        });
        subscriber.on('message', (channel, raw) => {
            if (channel !== RBAC_INVALIDATION_CHANNEL) return;
            try {
                const msg = JSON.parse(raw) as InvalidationMsg;
                if (msg.origin === INVALIDATION_ORIGIN) return; // our own echo
                applyLocalInvalidation(msg.kind, msg.key);
            } catch {
                /* ignore malformed messages */
            }
        });
    } catch (err) {
        logger.warn(
            { err },
            '[permissions] Redis unavailable — RBAC cache invalidation is local-only',
        );
    }
}

/** Drop one role (by slug) or the whole role cache. Call after a role edit. */
export function invalidateRoleCache(slug?: string): void {
    applyLocalInvalidation('role', slug);
    publishInvalidation('role', slug);
}
/** Drop one department's cached grant (by name/code) or all of them. */
export function invalidateDepartmentCache(key?: string): void {
    applyLocalInvalidation('department', key);
    publishInvalidation('department', key);
}
/** Drop one designation's cached grant (by name/code) or all of them. */
export function invalidateDesignationCache(key?: string): void {
    applyLocalInvalidation('designation', key);
    publishInvalidation('designation', key);
}
/** Drop a user's cached department/designation lookup. */
export function invalidateUserScope(userId?: string): void {
    applyLocalInvalidation('userScope', userId);
    publishInvalidation('userScope', userId);
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
    const raw = rawValue.trim();
    const key = raw.toLowerCase();
    if (!key) return [];
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.permissions;

    const doc = await model
        .findOne({
            isActive: true,
            $or: [
                // department codes are stored upper-cased; designation codes
                // are not — match both so a `staff.department` holding a code
                // still resolves its grant.
                { code: raw.toUpperCase() },
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
    // Expand the deny list the same way as grants so `order.*` (or `*`)
    // actually subtracts the concrete keys instead of looking for a literal
    // "order.*" entry that expansion has already removed.
    const deniedExpanded = expandWildcards(deniedPermissions);
    if (deniedExpanded[0] === WILDCARD_ALL) return [];
    const denied = new Set(deniedExpanded);
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
            `[permissions] grant lookup failed for role "${user.role}", using cached / built-in defaults`,
        );
        // Prefer a previously-loaded (possibly expired) role grant over the
        // built-in defaults: the built-ins can re-introduce a permission an
        // admin has explicitly removed from a system role in the DB.
        const staleRole = user.role
            ? roleCache.get(user.role.toLowerCase())?.permissions
            : undefined;
        const fallbackGrants =
            staleRole ??
            (user.role ? (SYSTEM_FALLBACK[user.role] ?? []) : []);
        return resolvePermissions(fallbackGrants, extra, denied);
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
