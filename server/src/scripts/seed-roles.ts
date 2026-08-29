/**
 * Seed / re-sync RBAC defaults.
 *
 *  - the five built-in roles: upserted by `slug`, always refreshed to the
 *    values in `constants/role-permission.ts` (custom roles untouched)
 *  - designation grant defaults (`constants/grant-defaults.ts`): applied
 *    ONLY to designations that currently have no permissions, so admin
 *    edits survive re-runs
 *
 *   npm run seed:roles
 */
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import RoleModel from '../models/role.model.js';
import DesignationModel from '../models/designation.model.js';
import { SYSTEM_ROLES } from '../constants/role-permission.js';
import { DESIGNATION_GRANT_DEFAULTS } from '../constants/grant-defaults.js';
import { sanitizePermissions } from '../constants/permission.js';
import { escapeRegex } from '../lib/sanitize.js';

const run = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(envConfig.mongo_uri as string);
        console.log('Connected.');

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

        console.log('Seeding designation grant defaults...');
        for (const grant of DESIGNATION_GRANT_DEFAULTS) {
            const permissions = sanitizePermissions([...grant.permissions]);
            const rx = new RegExp(`^${escapeRegex(grant.match)}$`, 'i');

            // only fill designations that have no permissions yet
            const result = await DesignationModel.updateMany(
                {
                    $and: [
                        { $or: [{ name: rx }, { code: grant.match.toLowerCase() }] },
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
                `  ${grant.match.padEnd(14)} matched, ${result.modifiedCount} designation(s) filled (${permissions.length} permissions)`,
            );
        }

        console.log('Done.');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Role seed failed:', error);
        process.exit(1);
    }
};

run();
