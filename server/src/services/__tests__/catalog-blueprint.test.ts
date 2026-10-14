/**
 * sanitizeBlueprint keeps the catalog blueprint clean: blanks become null (so a package inherits
 * from its service), junk is dropped, numbers are coerced.
 *
 * Run with: node --import tsx --test src/services/__tests__/catalog-blueprint.test.ts
 * (run from the `server/` directory)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeBlueprint } from '../catalog-blueprint.js';

describe('sanitizeBlueprint', () => {
    test('null clears the blueprint', () => {
        assert.equal(sanitizeBlueprint(null), null);
    });

    test('rejects non-objects', () => {
        assert.throws(() => sanitizeBlueprint([]), /blueprint must be an object/);
        assert.throws(() => sanitizeBlueprint('x'), /blueprint must be an object/);
    });

    test('drops unknown keys and invalid enum values', () => {
        const out = sanitizeBlueprint({ designMode: 'weird', evil: 1, policies: { ownership: 'nope' } })!;
        assert.equal(out.designMode, undefined);
        assert.equal(out.evil, undefined);
        assert.equal(out.policies.ownership, '');
    });

    test('inclusions: keeps labelled items, generates keys, coerces numbers', () => {
        const out = sanitizeBlueprint({
            inclusions: [
                { label: ' Domain ', kind: 'domain', termMonths: '12', owner: 'client', renews: 1 },
                { label: '   ' },
            ],
        })!;
        assert.equal(out.inclusions.length, 1);
        assert.equal(out.inclusions[0].label, 'Domain');
        assert.equal(out.inclusions[0].termMonths, 12);
        assert.equal(out.inclusions[0].renews, true);
        assert.equal(out.inclusions[0].included, true);
        assert.ok(out.inclusions[0].key);
    });

    test('blank / negative numbers become null, never 0 or NaN', () => {
        const out = sanitizeBlueprint({ revisions: { ui: '', dev: -1, uiExtraFee: 'abc', devExtraFee: 0 } })!;
        assert.deepEqual(out.revisions, { ui: null, dev: null, uiExtraFee: null, devExtraFee: 0 });
    });

    test('payment milestones keep label + percentage', () => {
        const out = sanitizeBlueprint({ paymentMilestones: [{ label: 'Advance', percentage: '50', note: ' on accept ' }, { label: '' }] })!;
        assert.deepEqual(out.paymentMilestones, [{ label: 'Advance', percentage: 50, note: 'on accept' }]);
    });
});
