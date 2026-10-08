/**
 * Knowledge-base helpers: entry limits, prompt context, low-confidence rule.
 *
 * Run with: node --import tsx --test src/lib/__tests__/knowledge-base-utils.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryProblem, formatContext, isLowConfidence } from '../knowledge-base-utils.js';
import { KB_LOW_CONFIDENCE, KB_MAX_CATEGORY_CHARS, KB_MAX_CHARS } from '../../constants/knowledge-base.js';

test('entry at the limit passes, one over fails with the numbers in the message', () => {
    assert.equal(entryProblem('a'.repeat(KB_MAX_CHARS)), null);
    const msg = entryProblem('a'.repeat(KB_MAX_CHARS + 1));
    assert.match(msg!, new RegExp(`${KB_MAX_CHARS + 1} characters; the limit is ${KB_MAX_CHARS}`));
});

test('category length is limited too', () => {
    assert.equal(entryProblem('ok', 'x'.repeat(KB_MAX_CATEGORY_CHARS)), null);
    assert.match(entryProblem('ok', 'x'.repeat(KB_MAX_CATEGORY_CHARS + 1))!, /Category/);
});

test('context tags entries with their category and separates them', () => {
    assert.equal(
        formatContext([
            { text: 'Open Sun-Thu', source: 'Hours' },
            { text: 'No category', source: null },
        ]),
        '[Hours] Open Sun-Thu\n---\nNo category',
    );
    assert.equal(formatContext([]), '');
});

test('low confidence: nothing, or best match under the threshold', () => {
    assert.equal(isLowConfidence([]), true);
    assert.equal(isLowConfidence([{ score: KB_LOW_CONFIDENCE - 0.01 }]), true);
    assert.equal(isLowConfidence([{ score: KB_LOW_CONFIDENCE }]), false);
});
