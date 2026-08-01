/**
 * Unit tests for E2-F1-T1: escaping user-supplied search input before it
 * reaches MongoDB `$regex` in QuotationService.getQuotations and
 * ReceiptService.getReceipts.
 *
 * Scope note: mirrors the approach taken in order-status-transitions.test.ts
 * (E1-F1-T1) — these tests exercise the actual `escapeRegex()` transform
 * applied to representative search inputs, and independently prove the
 * resulting pattern is safe (constant-time, no catastrophic backtracking)
 * and behaves as a literal-substring matcher. A full DB-backed integration
 * test (real `getQuotations`/`getReceipts` call against Mongo, asserting the
 * actual query results) is out of scope until E7-F1-T1 provides test
 * infrastructure — same documented limitation as E1-F1-T1's Subtask (d).
 *
 * Run with: node --import tsx --test src/services/__tests__/search-regex-escaping.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { escapeRegex } from '../../lib/sanitize.js';

describe('escapeRegex — normal search (no behavioral change)', () => {
    test('plain alphanumeric text is returned unchanged', () => {
        assert.equal(escapeRegex('QTN-2026-0001'), 'QTN-2026-0001');
        assert.equal(escapeRegex('Acme Corp'), 'Acme Corp');
    });

    test('an email search term only has its "." escaped ("@" is not a metacharacter)', () => {
        assert.equal(escapeRegex('john@example.com'), 'john@example\\.com');
    });

    test('a plain term still matches case-insensitively as a substring, same as before', () => {
        const escaped = escapeRegex('acme');
        const re = new RegExp(escaped, 'i');
        assert.ok(re.test('ACME Corp'));
        assert.ok(re.test('Contact: Acme Industries'));
        assert.ok(!re.test('Widgets Inc'));
    });
});

describe('escapeRegex — special regex characters (now literal, not pattern)', () => {
    test('a "." is escaped and no longer acts as a wildcard', () => {
        const escaped = escapeRegex('a.b');
        assert.equal(escaped, 'a\\.b');
        const re = new RegExp(escaped, 'i');
        assert.ok(re.test('a.b'), 'must still match the literal string');
        assert.ok(!re.test('axb'), 'must NOT match via "." wildcard semantics anymore');
    });

    test('parentheses, brackets, and quantifiers are all escaped', () => {
        const input = 'RCPT-(2026)-[001]+test?';
        const escaped = escapeRegex(input);
        // Every metacharacter in the input must be backslash-prefixed.
        for (const ch of ['(', ')', '[', ']', '+', '?']) {
            assert.ok(
                escaped.includes(`\\${ch}`),
                `expected "${ch}" to be escaped in: ${escaped}`,
            );
        }
        // And the escaped pattern must match the literal string exactly.
        const re = new RegExp(escaped, 'i');
        assert.ok(re.test(input));
    });

    test('a lone "$" or "^" no longer anchors the pattern', () => {
        const escaped = escapeRegex('total$100');
        const re = new RegExp(escaped, 'i');
        assert.ok(re.test('Order total$100 due'));
        assert.ok(!re.test('total$100'.slice(0, -1) + 'x')); // sanity: still literal
    });
});

describe('escapeRegex — regex-injection-shaped input (the actual ReDoS fix)', () => {
    test('a classic catastrophic-backtracking pattern resolves instantly as a literal string', () => {
        const maliciousInput = '(a+)+$';
        const escaped = escapeRegex(maliciousInput);
        const re = new RegExp(escaped, 'i');

        const start = Date.now();
        // Would hang for seconds-to-minutes if `(a+)+$` were compiled as a
        // live regex against a long non-matching string of "a"s. As a
        // literal string match, this must resolve in well under a second.
        const target = 'a'.repeat(40) + '!';
        const matched = re.test(target);
        const elapsedMs = Date.now() - start;

        assert.equal(matched, false);
        assert.ok(
            elapsedMs < 500,
            `expected near-instant literal match, took ${elapsedMs}ms — possible ReDoS regression`,
        );
    });

    test('nested-quantifier injection attempts are neutralized to a literal (non-matching) pattern', () => {
        const payloads = ['(a|aa)+$', '(.*)*', '([a-zA-Z]+)*$'];
        for (const payload of payloads) {
            const escaped = escapeRegex(payload);
            const re = new RegExp(escaped, 'i');
            const start = Date.now();
            const matched = re.test('a'.repeat(50));
            const elapsedMs = Date.now() - start;
            assert.equal(matched, false, `payload "${payload}" should not match unrelated input literally`);
            assert.ok(elapsedMs < 500, `payload "${payload}" took ${elapsedMs}ms — possible ReDoS regression`);
        }
    });

    test('an injection payload matches only when the literal payload text is actually present', () => {
        const payload = '(a+)+$';
        const escaped = escapeRegex(payload);
        const re = new RegExp(escaped, 'i');
        assert.ok(re.test(`Client note: ${payload} was requested verbatim`));
    });
});
