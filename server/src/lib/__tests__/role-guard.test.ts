/**
 * Unit tests for Phase 3's role-administration guards (pure, no DB).
 *
 * Run with: node --import tsx --test src/lib/__tests__/role-guard.test.ts
 * (from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    partitionByActorGrant,
    assertAssignablePermissions,
    assertRoleDeletable,
    assertRoleIdentityUnchanged,
} from '../role-guard.js';

describe('partitionByActorGrant', () => {
    test('actor can grant permissions they hold', () => {
        const { allowed, forbidden } = partitionByActorGrant(
            ['order.read', 'order.create'],
            ['order.read', 'order.create'],
        );
        assert.deepEqual(allowed, ['order.read', 'order.create']);
        assert.deepEqual(forbidden, []);
    });

    test('actor cannot grant permissions they lack', () => {
        const { allowed, forbidden } = partitionByActorGrant(
            ['order.read'],
            ['order.read', 'payroll.run'],
        );
        assert.deepEqual(allowed, ['order.read']);
        assert.deepEqual(forbidden, ['payroll.run']);
    });

    test('only a "*" holder can grant wildcards', () => {
        const nonSuper = partitionByActorGrant(['order.read'], ['order.*']);
        assert.deepEqual(nonSuper.forbidden, ['order.*']);

        const superuser = partitionByActorGrant(['*'], ['order.*', '*', 'payroll.run']);
        assert.deepEqual(superuser.forbidden, []);
    });
});

describe('assertAssignablePermissions', () => {
    test('rejects unknown permission strings (400)', () => {
        assert.throws(
            () => assertAssignablePermissions(['*'], ['made.up.perm']),
            /Unknown permission/,
        );
    });

    test('rejects escalation (403)', () => {
        assert.throws(
            () => assertAssignablePermissions(['order.read'], ['payroll.run']),
            /cannot grant/i,
        );
    });

    test('returns a clean de-duplicated list on success', () => {
        const out = assertAssignablePermissions(
            ['*'],
            ['order.read', 'order.read', 'payroll.run'],
        );
        assert.deepEqual([...out].sort(), ['order.read', 'payroll.run']);
    });
});

describe('assertRoleDeletable', () => {
    test('throws for a built-in slug', () => {
        assert.throws(() => assertRoleDeletable('super_admin'), /built-in/);
        assert.throws(() => assertRoleDeletable('staff'), /built-in/);
    });

    test('allows a custom slug', () => {
        assert.doesNotThrow(() => assertRoleDeletable('order-manager'));
    });
});

describe('assertRoleIdentityUnchanged', () => {
    const sysRole = { slug: 'admin', isSystem: true };

    test('blocks slug change on a system role', () => {
        assert.throws(
            () => assertRoleIdentityUnchanged(sysRole, { slug: 'admin-2' }),
            /Cannot change the slug/,
        );
    });

    test('blocks clearing isSystem', () => {
        assert.throws(
            () => assertRoleIdentityUnchanged(sysRole, { isSystem: false }),
            /Cannot clear the built-in flag/,
        );
    });

    test('allows editing permissions/description (identity untouched)', () => {
        assert.doesNotThrow(() =>
            assertRoleIdentityUnchanged(sysRole, { slug: 'admin', isSystem: true }),
        );
    });

    test('no-op for custom roles', () => {
        assert.doesNotThrow(() =>
            assertRoleIdentityUnchanged({ slug: 'x', isSystem: false }, { slug: 'y' }),
        );
    });
});
