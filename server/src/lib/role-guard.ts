/**
 * Phase 3 — guard helpers for role / permission administration.
 *
 * Pure functions (no DB) so they are easy to unit-test. Phase 5's role CRUD
 * and "assign permissions to user" flows call these before writing.
 *
 * Two rules they enforce:
 *   1. No privilege escalation — an actor can only grant permissions they
 *      themselves hold. (`super_admin` holds `*`, so this never blocks them.)
 *   2. Built-in roles are protected — their `slug` / `isSystem` cannot
 *      change and they cannot be deleted (permissions may still be edited).
 */
import { AppError } from '../utils/AppError.js';
import { hasPermission } from './permissions.js';
import {
    isAssignablePermission,
    sanitizePermissions,
    WILDCARD_ALL,
} from '../constants/permission.js';
import { SYSTEM_ROLE_SLUGS } from '../constants/role-permission.js';

/** Split a permission list into ones the actor may grant and ones they may not. */
export function partitionByActorGrant(
    actorPermissions: readonly string[] | undefined | null,
    requested: readonly string[],
): { allowed: string[]; forbidden: string[] } {
    const allowed: string[] = [];
    const forbidden: string[] = [];
    for (const perm of requested) {
        // Only the holder of `*` may hand out `*` or `resource.*`.
        const needsSuperuser = perm === WILDCARD_ALL || perm.endsWith('.*');
        const canGrant = needsSuperuser
            ? hasPermission(actorPermissions, WILDCARD_ALL)
            : hasPermission(actorPermissions, perm);
        (canGrant ? allowed : forbidden).push(perm);
    }
    return { allowed, forbidden };
}

/**
 * Validate a requested permission list for a write. Drops unknown strings,
 * de-duplicates, then throws 403 if anything remains that the actor cannot
 * grant. Returns the clean list to persist.
 */
export function assertAssignablePermissions(
    actorPermissions: readonly string[] | undefined | null,
    requested: readonly string[],
): string[] {
    const unknown = requested.filter((p) => !isAssignablePermission(p));
    if (unknown.length) {
        throw new AppError(
            `Unknown permission(s): ${unknown.join(', ')}`,
            400,
        );
    }

    const clean = sanitizePermissions(requested);
    const { forbidden } = partitionByActorGrant(actorPermissions, clean);
    if (forbidden.length) {
        throw new AppError(
            `You cannot grant permission(s) you do not hold: ${forbidden.join(', ')}`,
            403,
        );
    }
    return clean;
}

/** Throw if `slug` names a built-in role (delete / slug-change not allowed). */
export function assertRoleDeletable(slug: string): void {
    if (SYSTEM_ROLE_SLUGS.has(slug)) {
        throw new AppError(`The "${slug}" role is built-in and cannot be deleted.`, 400);
    }
}

/**
 * Throw if a proposed update would change a built-in role's identity.
 * `permissions`, `description` and `isActive` may still be edited.
 */
export function assertRoleIdentityUnchanged(
    current: { slug: string; isSystem: boolean },
    update: { slug?: string; isSystem?: boolean },
): void {
    if (!current.isSystem) return;
    if (update.slug !== undefined && update.slug !== current.slug) {
        throw new AppError(`Cannot change the slug of the built-in "${current.slug}" role.`, 400);
    }
    if (update.isSystem !== undefined && update.isSystem !== true) {
        throw new AppError(`Cannot clear the built-in flag on the "${current.slug}" role.`, 400);
    }
}
