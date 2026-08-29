import DepartmentModel from '../models/department.model.js';
import DesignationModel from '../models/designation.model.js';
import { AppError } from '../utils/AppError.js';
import { assertAssignablePermissions } from '../lib/role-guard.js';
import {
    invalidateDepartmentCache,
    invalidateDesignationCache,
} from '../lib/permissions.js';
import auditService from './audit.service.js';
import type { RoleActor } from './role.service.js';

/**
 * Phase 6 — set the permission grant list on a department or designation.
 * Escalation-guarded (`assertAssignablePermissions`): the actor can only
 * hand out permissions they themselves hold. Busts the resolver cache so
 * the change takes effect within a request or two.
 */

const setDepartmentPermissions = async (
    id: string,
    permissions: string[],
    actor: RoleActor,
) => {
    const doc = await DepartmentModel.findById(id);
    if (!doc) throw new AppError('Department not found.', 404);

    doc.permissions = assertAssignablePermissions(actor.permissions, permissions);
    await doc.save();

    invalidateDepartmentCache(doc.name);
    if (doc.code) invalidateDepartmentCache(doc.code);

    await auditService.createLog({
        userId: actor.id ?? 'system',
        action: 'DEPARTMENT_PERMISSIONS_SET',
        entity: 'Department',
        entityId: id,
        ipAddress: actor.ipAddress,
        details: { permissions: doc.permissions },
    });

    return doc;
};

const setDesignationPermissions = async (
    id: string,
    permissions: string[],
    actor: RoleActor,
) => {
    const doc = await DesignationModel.findById(id);
    if (!doc) throw new AppError('Designation not found.', 404);

    doc.permissions = assertAssignablePermissions(actor.permissions, permissions);
    await doc.save();

    invalidateDesignationCache(doc.name);
    if (doc.code) invalidateDesignationCache(doc.code);

    await auditService.createLog({
        userId: actor.id ?? 'system',
        action: 'DESIGNATION_PERMISSIONS_SET',
        entity: 'Designation',
        entityId: id,
        ipAddress: actor.ipAddress,
        details: { permissions: doc.permissions },
    });

    return doc;
};

export default { setDepartmentPermissions, setDesignationPermissions };
