/**
 * isValidMetaSignature: only Meta-signed webhook bodies are accepted.
 *
 * Run with: node --import tsx --test src/lib/__tests__/whatsapp-signature.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { isValidMetaSignature } from '../whatsapp-signature.js';

const secret = 's3cret';
const body = Buffer.from('{"entry":[]}');
const sign = (b: Buffer, s = secret) => `sha256=${createHmac('sha256', s).update(b).digest('hex')}`;

test('valid signature passes', () => assert.equal(isValidMetaSignature(body, sign(body), secret), true));
test('tampered body fails', () => assert.equal(isValidMetaSignature(Buffer.from('{"entry":[1]}'), sign(body), secret), false));
test('wrong secret fails', () => assert.equal(isValidMetaSignature(body, sign(body, 'other'), secret), false));
test('missing / malformed header fails', () => {
    assert.equal(isValidMetaSignature(body, undefined, secret), false);
    assert.equal(isValidMetaSignature(body, 'sha256=zz', secret), false);
    assert.equal(isValidMetaSignature(body, sign(body).slice(7), secret), false);
});
test('empty app secret never validates', () => assert.equal(isValidMetaSignature(body, sign(body, ''), ''), false));
