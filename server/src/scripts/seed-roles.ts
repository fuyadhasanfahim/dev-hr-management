/**
 * Phase 1 — Seed / re-sync the five built-in roles.
 *
 * Idempotent: safe to run repeatedly and on every deploy. For each system
 * role it upserts by `slug`, refreshing `name`, `description`, `permissions`
 * and forcing `isSystem: true` / `isActive: true`. Custom roles created by
 * admins are never touched.
 *
 *   npm run seed:roles
 */
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import RoleModel from '../models/role.model.js';
import { SYSTEM_ROLES } from '../constants/role-permission.js';
import { sanitizePermissions } from '../constants/permission.js';

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

        console.log('Done.');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Role seed failed:', error);
        process.exit(1);
    }
};

run();
