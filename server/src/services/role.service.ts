import mongoose from 'mongoose';
import RoleModel from '../models/role.model.js';
import UserModel from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { invalidateRoleCache } from '../lib/permissions.js';
import {
    assertAssignablePermissions,
    assertRoleDeletable,
    assertRoleIdentityUnchanged,
} from '../lib/role-guard.js';
import auditService from './audit.service.js';
import {
    ACTION_LABELS,
    ALL_PERMISSIONS,
    PERMISSION_GROUPS,
    sanitizePermissions,
} from '../constants/permission.js';

/**
 * Phase 3 — read-only role queries + the permission catalog the admin UI
 * renders its checkbox matrix from.
 * Phase 5 — role create / update / delete and per-user access assignment,
 * all guarded against privilege escalation (`lib/role-guard.ts`) and
 * audit-logged.
 */

export interface RoleActor {
    id?: string;
    permissions?: string[];
    ipAddress?: string | undefined;
}

const slugify = (input: string) =>
    input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

// --------------------------------------------------------------------------
// reads
// --------------------------------------------------------------------------

const listRoles = async () => {
    return RoleModel.find().sort({ isSystem: -1, name: 1 }).lean();
};

const getRoleBySlug = async (slug: string) => {
    const role = await RoleModel.findOne({ slug: slug.toLowerCase() }).lean();
    if (!role) throw new AppError(`Role "${slug}" not found.`, 404);
    return role;
};

/** Static description of every permission, grouped by resource. */
const getPermissionCatalog = () => {
    const groups = Object.entries(PERMISSION_GROUPS).map(([key, def]) => ({
        resource: key,
        label: def.label,
        permissions: def.actions.map((action) => ({
            key: `${key}.${action}`,
            action,
            label: ACTION_LABELS[action] ?? action,
        })),
    }));

    return { groups, all: ALL_PERMISSIONS };
};

// --------------------------------------------------------------------------
// mutations
// --------------------------------------------------------------------------

const createRole = async (
    input: {
        name: string;
        slug?: string;
        description?: string;
        permissions: string[];
    },
    actor: RoleActor,
) => {
    const slug = (input.slug ?? slugify(input.name)).toLowerCase();
    if (!slug) throw new AppError('Could not derive a slug from the name.', 400);

    const clash = await RoleModel.findOne({
        $or: [{ slug }, { name: input.name.trim() }],
    }).lean();
    if (clash) {
        throw new AppError('A role with that name or slug already exists.', 409);
    }

    // throws 400 (unknown perm) / 403 (escalation)
    const permissions = assertAssignablePermissions(
        actor.permissions,
        input.permissions,
    );

    const role = await RoleModel.create({
        name: input.name.trim(),
        slug,
        description: input.description?.trim(),
        permissions,
        isSystem: false,
        isActive: true,
        createdBy: actor.id,
    });

    await auditService.createLog({
        userId: actor.id ?? 'system',
        action: 'ROLE_CREATE',
        entity: 'Role',
        entityId: role._id.toString(),
        ipAddress: actor.ipAddress,
        details: { slug, permissions },
    });

    return role;
};

const updateRole = async (
    slug: string,
    update: {
        name?: string;
        description?: string;
        permissions?: string[];
        isActive?: boolean;
    },
    actor: RoleActor,
) => {
    const role = await RoleModel.findOne({ slug: slug.toLowerCase() });
    if (!role) throw new AppError(`Role "${slug}" not found.`, 404);

    // built-in roles: identity is frozen, permissions/description still editable
    assertRoleIdentityUnchanged(
        { slug: role.slug, isSystem: role.isSystem },
        {},
    );

    if (update.name !== undefined && update.name.trim() !== role.name) {
        const clash = await RoleModel.findOne({
            name: update.name.trim(),
            _id: { $ne: role._id },
        }).lean();
        if (clash) throw new AppError('Another role already uses that name.', 409);
        role.name = update.name.trim();
    }
    if (update.description !== undefined) {
        role.description = update.description.trim();
    }
    if (update.isActive !== undefined) {
        if (role.isSystem && update.isActive === false) {
            throw new AppError('Built-in roles cannot be deactivated.', 400);
        }
        role.isActive = update.isActive;
    }
    if (update.permissions !== undefined) {
        role.permissions = assertAssignablePermissions(
            actor.permissions,
            update.permissions,
        );
    }

    await role.save();
    invalidateRoleCache(role.slug);

    await auditService.createLog({
        userId: actor.id ?? 'system',
        action: 'ROLE_UPDATE',
        entity: 'Role',
        entityId: role._id.toString(),
        ipAddress: actor.ipAddress,
        details: {
            slug: role.slug,
            permissions: role.permissions,
            isActive: role.isActive,
        },
    });

    return role;
};

const deleteRole = async (slug: string, actor: RoleActor) => {
    const s = slug.toLowerCase();
    assertRoleDeletable(s); // throws for built-in slugs

    const role = await RoleModel.findOne({ slug: s });
    if (!role) throw new AppError(`Role "${slug}" not found.`, 404);

    const inUse = await UserModel.countDocuments({ role: s });
    if (inUse > 0) {
        throw new AppError(
            `Cannot delete: ${inUse} user(s) still have the "${s}" role. Reassign them first.`,
            409,
        );
    }

    await role.deleteOne();
    invalidateRoleCache(s);

    await auditService.createLog({
        userId: actor.id ?? 'system',
        action: 'ROLE_DELETE',
        entity: 'Role',
        entityId: role._id.toString(),
        ipAddress: actor.ipAddress,
        details: { slug: s },
    });

    return { slug: s };
};

/**
 * Set a user's role and/or per-user permission overrides.
 * `role` and `extraPermissions` are escalation-guarded (the actor must hold
 * everything they hand out); `deniedPermissions` is only sanitised to known
 * keys since taking access away is never an escalation.
 */
const assignUserAccess = async (
    userId: string,
    input: {
        role?: string;
        extraPermissions?: string[];
        deniedPermissions?: string[];
    },
    actor: RoleActor,
) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new AppError('Invalid user id.', 400);
    }
    const _id = new mongoose.Types.ObjectId(userId);

    const user = await UserModel.findOne({ _id });
    if (!user) throw new AppError('User not found.', 404);

    const set: Record<string, unknown> = {};

    if (input.role !== undefined) {
        const roleDoc = await RoleModel.findOne({
            slug: input.role.toLowerCase(),
            isActive: true,
        }).lean();
        if (!roleDoc) {
            throw new AppError(`Role "${input.role}" not found or inactive.`, 400);
        }
        // the actor must be able to grant every permission the role carries
        assertAssignablePermissions(actor.permissions, roleDoc.permissions);

        // Lockout protection: never let the last super admin be demoted.
        if (
            (user.role as string) === 'super_admin' &&
            roleDoc.slug !== 'super_admin'
        ) {
            const remaining = await UserModel.countDocuments({
                role: 'super_admin',
            });
            if (remaining <= 1) {
                throw new AppError(
                    'Cannot change the role of the last super admin.',
                    400,
                );
            }
        }

        set.role = roleDoc.slug;
    }

    if (input.extraPermissions !== undefined) {
        set.extraPermissions = assertAssignablePermissions(
            actor.permissions,
            input.extraPermissions,
        );
    }

    if (input.deniedPermissions !== undefined) {
        // Not escalation-guarded on purpose: `role.assign` is a super-admin
        // permission by default, and taking access away is never an
        // escalation. If `role.assign` is ever delegated to a non-super-admin
        // custom role, revisit whether clearing an existing deny entry (which
        // can re-expose a role-granted permission) needs a check here.
        set.deniedPermissions = sanitizePermissions(input.deniedPermissions);
    }

    await UserModel.updateOne({ _id }, { $set: set });

    await auditService.createLog({
        userId: actor.id ?? 'system',
        action: 'USER_ACCESS_ASSIGN',
        entity: 'User',
        entityId: userId,
        ipAddress: actor.ipAddress,
        details: set,
    });

    return { userId, ...set };
};

export default {
    listRoles,
    getRoleBySlug,
    getPermissionCatalog,
    createRole,
    updateRole,
    deleteRole,
    assignUserAccess,
};
