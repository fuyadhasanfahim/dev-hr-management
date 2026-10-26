/**
 * Phone and email normalisation behind Contact matching: the same person on WhatsApp (8801…) and on the
 * website form (01…, +880 1…) must resolve to the same Contact.
 *
 * Run with: node --import tsx --test src/services/__tests__/contact.service.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, normalizePhone } from '../contact.service.js';

test('Bangladesh numbers written differently normalise to one value', () => {
    for (const raw of ['01712345678', '+8801712345678', '8801712345678', '+880 1712-345678', '008801712345678', '1712345678']) {
        assert.equal(normalizePhone(raw), '8801712345678', raw);
    }
});

test('other international numbers keep their digits', () => {
    assert.equal(normalizePhone('+1 (415) 555-0100'), '14155550100');
});

test('unusable phone values become empty', () => {
    for (const raw of ['', undefined, null, 'abc', '123', '12345678901234567']) {
        assert.equal(normalizePhone(raw as string), '', String(raw));
    }
});

test('emails are lower-cased and validated', () => {
    assert.equal(normalizeEmail('  Fuyad@Webbriks.COM '), 'fuyad@webbriks.com');
    assert.equal(normalizeEmail('not-an-email'), '');
    assert.equal(normalizeEmail(undefined), '');
});
