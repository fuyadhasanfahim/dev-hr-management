import RoleModel from '../models/role.model.js';
import { AppError } from '../utils/AppError.js';
import {
    ACTION_LABELS,
    ALL_PERMISSIONS,
    PERMISSION_GROUPS,
} from '../constants/permission.js';

/**
 * Phase 3 — read-only role queries + the permission catalog the admin UI
 * (Phase 5) renders its checkbox matrix from.
 *
 * Role mutations (create / update / delete, with the privilege-escalation
 * guards in `lib/role-guard.ts`) land in Phase 5.
 */

const listRoles = async () => {
    return RoleModel.find()
        .sort({ isSystem: -1, name: 1 })
        .lean();
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

    return {
        groups,
        all: ALL_PERMISSIONS,
    };
};

export default {
    listRoles,
    getRoleBySlug,
    getPermissionCatalog,
};
