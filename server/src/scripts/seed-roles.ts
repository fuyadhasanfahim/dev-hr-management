/**
 * Seed / re-sync RBAC defaults.
 *
 *  - the five built-in roles: upserted by `slug`, always refreshed to the
 *    values in `constants/role-permission.ts` (custom roles untouched)
 *  - the "Telemarketing" department: created if missing, and every staff
 *    member with the Telemarketer designation is moved into it
 *  - department / designation grant defaults (`constants/grant-defaults.ts`):
 *    applied ONLY to a scope that currently has no permissions, so admin
 *    edits made from the UI survive re-runs
 *
 *   npm run seed:roles
 */
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import RoleModel from '../models/role.model.js';
import DepartmentModel from '../models/department.model.js';
import DesignationModel from '../models/designation.model.js';
import StaffModel from '../models/staff.model.js';
import { SYSTEM_ROLES } from '../constants/role-permission.js';
import {
    DEPARTMENT_GRANT_DEFAULTS,
    DESIGNATION_GRANT_DEFAULTS,
    type ScopeGrantSeed,
} from '../constants/grant-defaults.js';
import { sanitizePermissions } from '../constants/permission.js';
import { escapeRegex } from '../lib/sanitize.js';

const TELEMARKETING_DEPT = { name: 'Telemarketing', code: 'TELEMARKETING' };

async function applyScopeGrants(
    label: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: any,
    defaults: readonly ScopeGrantSeed[],
) {
    for (const grant of defaults) {
        const permissions = sanitizePermissions([...grant.permissions]);
        const rx = new RegExp(`^${escapeRegex(grant.match)}$`, 'i');

        const result = await model.updateMany(
            {
                $and: [
                    {
                        $or: [
                            { name: rx },
                            { code: grant.match.toLowerCase() },
                            { code: grant.match.toUpperCase() },
                        ],
                    },
                    {
                        $or: [
                            { permissions: { $exists: false } },
                            { permissions: { $size: 0 } },
                        ],
                    },
                ],
            },
            { $set: { permissions } },
        );
        console.log(
            `  ${label}: ${grant.match.padEnd(14)} -> ${result.modifiedCount} filled (${permissions.length} permissions)`,
        );
    }
}

const run = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(envConfig.mongo_uri as string);
        console.log('Connected.');

        // ── built-in roles ────────────────────────────────────────────────
        for (const role of SYSTEM_ROLES) {
            const permissions = sanitizePermissions([...role.permissions]);
            const dropped = role.permissions.length - permissions.length;
            if (dropped > 0) {
                console.warn(
                    `  ! ${role.slug}: ${dropped} permission(s) not in catalog were dropped`,
                );
            }

            const result = await RoleModel.updateOne(
                { slug: role.slug },
                {
                    $set: {
                        name: role.name,
                        description: role.description,
                        permissions,
                        isSystem: true,
                        isActive: true,
                    },
                },
                { upsert: true },
            );

            const state = result.upsertedCount ? 'created' : 'updated';
            console.log(`  ${role.slug.padEnd(12)} ${state} (${permissions.length} permissions)`);
        }

        // ── Telemarketing department + staff move ─────────────────────────
        console.log('Ensuring "Telemarketing" department...');
        const anyAdmin = await mongoose.connection
            .collection('user')
            .findOne({ role: { $in: ['super_admin', 'admin'] } });

        const deptRes = await DepartmentModel.updateOne(
            { $or: [{ name: TELEMARKETING_DEPT.name }, { code: TELEMARKETING_DEPT.code }] },
            {
                $setOnInsert: {
                    name: TELEMARKETING_DEPT.name,
                    code: TELEMARKETING_DEPT.code,
                    description: 'Telemarketing team — own leads/clients, order create/update, sees prices & client info.',
                    isActive: true,
                    ...(anyAdmin ? { createdBy: anyAdmin._id } : {}),
                },
            },
            { upsert: true },
        );
        console.log(
            deptRes.upsertedCount ? '  Telemarketing department created' : '  Telemarketing department already exists',
        );

        const moved = await StaffModel.updateMany(
            {
                designation: { $regex: /^telemarketer$/i },
                department: { $ne: TELEMARKETING_DEPT.name },
            },
            { $set: { department: TELEMARKETING_DEPT.name } },
        );
        console.log(`  Moved ${moved.modifiedCount} telemarketer staff into "Telemarketing"`);

        // ── scope grant defaults ─────────────────────────────────────────
        console.log('Seeding scope grant defaults...');
        await applyScopeGrants('department', DepartmentModel, DEPARTMENT_GRANT_DEFAULTS);
        await applyScopeGrants('designation', DesignationModel, DESIGNATION_GRANT_DEFAULTS);

        console.log('Done.');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Role seed failed:', error);
        process.exit(1);
    }
};

run();
