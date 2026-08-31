/**
 * Unit tests for Phase 2's permission resolver (pure parts only).
 *
 * `resolvePermissions` / `hasPermission*` take already-loaded permission
 * lists, so these run without a database. `getEffectivePermissions` (which
 * hits RoleModel) is intentionally not exercised here.
 *
 * Run with: node --import tsx --test src/lib/__tests__/permissions.test.ts
 * (from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolvePermissions,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
} from '../permissions.js';

describe('resolvePermissions', () => {
    test('merges role + extra permissions', () => {
        const out = resolvePermissions(['order.read'], ['order.create']);
        assert.deepEqual([...out].sort(), ['order.create', 'order.read']);
    });

    test('de-duplicates', () => {
        const out = resolvePermissions(['order.read'], ['order.read']);
        assert.deepEqual(out, ['order.read']);
    });

    test('expands a resource wildcard against the catalog', () => {
        const out = resolvePermissions(['order.*']);
        assert.ok(out.includes('order.read'));
        assert.ok(out.includes('order.create'));
        assert.ok(out.includes('order.delete'));
        assert.ok(!out.includes('order.*'));
    });

    test('a bare "*" short-circuits to ["*"]', () => {
        assert.deepEqual(resolvePermissions(['*', 'order.read']), ['*']);
        assert.deepEqual(resolvePermissions([], ['*']), ['*']);
    });

    test('denied permissions are subtracted', () => {
        const out = resolvePermissions(['order.*'], [], ['order.delete']);
        assert.ok(out.includes('order.read'));
        assert.ok(!out.includes('order.delete'));
    });

    test('denied does not un-superuser a "*"', () => {
        // documented behaviour: once you are "*", a deny list is ignored
        assert.deepEqual(resolvePermissions(['*'], [], ['order.delete']), ['*']);
    });

    test('a wildcard in the deny list subtracts the concrete keys', () => {
        const out = resolvePermissions(['order.*', 'client.read'], [], ['order.*']);
        assert.ok(!out.some((p) => p.startsWith('order.')));
        assert.ok(out.includes('client.read'));
    });

    test('a bare "*" deny removes everything', () => {
        assert.deepEqual(resolvePermissions(['order.*', 'client.*'], [], ['*']), []);
    });

    test('unknown wildcard resource expands to nothing', () => {
        assert.deepEqual(resolvePermissions(['bogus.*']), []);
    });
});

describe('hasPermission', () => {
    test('exact match', () => {
        assert.equal(hasPermission(['order.read'], 'order.read'), true);
        assert.equal(hasPermission(['order.read'], 'order.create'), false);
    });

    test('"*" grants everything', () => {
        assert.equal(hasPermission(['*'], 'anything.at.all'), true);
    });

    test('empty / nullish', () => {
        assert.equal(hasPermission([], 'order.read'), false);
        assert.equal(hasPermission(undefined, 'order.read'), false);
        assert.equal(hasPermission(null, 'order.read'), false);
    });
});

describe('hasAllPermissions / hasAnyPermission', () => {
    const perms = ['order.read', 'order.create'];

    test('all', () => {
        assert.equal(hasAllPermissions(perms, ['order.read', 'order.create']), true);
        assert.equal(hasAllPermissions(perms, ['order.read', 'order.delete']), false);
    });

    test('any', () => {
        assert.equal(hasAnyPermission(perms, ['order.delete', 'order.create']), true);
        assert.equal(hasAnyPermission(perms, ['order.delete', 'order.update']), false);
    });
});
