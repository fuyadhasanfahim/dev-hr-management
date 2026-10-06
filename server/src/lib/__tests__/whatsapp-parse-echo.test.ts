/**
 * parseEcho: what the business did in the WhatsApp Business app → what the inbox mirrors.
 *
 * Run with: node --import tsx --test src/lib/__tests__/whatsapp-parse-echo.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEcho } from '../whatsapp-inbound.js';

const base = { from: '8801977201923', to: '8801700000000', id: 'wamid.E1', timestamp: '0' };

test('text echo → message to the customer', () => {
    assert.deepEqual(parseEcho({ ...base, type: 'text', text: { body: 'hello' } }), {
        kind: 'message',
        customer: '8801700000000',
        whatsappMsgId: 'wamid.E1',
        content: { type: 'text', body: 'hello' },
    });
});

test('image echo keeps its media', () => {
    const r = parseEcho({ ...base, type: 'image', image: { id: 'm1', mime_type: 'image/jpeg', caption: 'pic' } });
    assert.equal(r?.kind, 'message');
    assert.equal(r?.kind === 'message' && r.content.media?.id, 'm1');
});

test('edit echo → original id + new text', () => {
    assert.deepEqual(
        parseEcho({ ...base, type: 'edit', edit: { original_message_id: 'wamid.A', message: { ...base, type: 'text', text: { body: 'fixed' } } } }),
        { kind: 'edit', originalId: 'wamid.A', body: 'fixed' },
    );
});

test('revoke echo → original id', () => {
    assert.deepEqual(parseEcho({ ...base, type: 'revoke', revoke: { original_message_id: 'wamid.A' } }), { kind: 'revoke', originalId: 'wamid.A' });
});

test('unreadable echoes are dropped', () => {
    assert.equal(parseEcho({ ...base, type: 'revoke' }), null);
    assert.equal(parseEcho({ ...base, type: 'edit', edit: {} }), null);
    assert.equal(parseEcho({ ...base, to: undefined, type: 'text', text: { body: 'x' } }), null);
});
