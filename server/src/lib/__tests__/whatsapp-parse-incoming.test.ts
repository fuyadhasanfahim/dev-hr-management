/**
 * parseIncoming: every inbound WhatsApp webhook message → what we store.
 *
 * Run with: node --import tsx --test src/lib/__tests__/whatsapp-parse-incoming.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIncoming } from '../whatsapp-inbound.js';

const base = { from: '8801700000000', id: 'wamid.1', timestamp: '0' };

test('text', () => {
    assert.deepEqual(parseIncoming({ ...base, type: 'text', text: { body: 'hi' } }), { type: 'text', body: 'hi' });
});

test('image keeps caption + media id', () => {
    assert.deepEqual(
        parseIncoming({ ...base, type: 'image', image: { id: 'm1', mime_type: 'image/jpeg', caption: 'receipt' } }),
        { type: 'image', body: 'receipt', media: { id: 'm1', mimeType: 'image/jpeg', filename: undefined, voice: undefined } },
    );
});

test('voice note', () => {
    const parsed = parseIncoming({ ...base, type: 'audio', audio: { id: 'm2', mime_type: 'audio/ogg; codecs=opus', voice: true } });
    assert.equal(parsed?.type, 'audio');
    assert.equal(parsed?.body, '');
    assert.equal(parsed?.media?.voice, true);
});

test('call permission reply becomes a call event line', () => {
    const parsed = parseIncoming({
        ...base,
        type: 'interactive',
        interactive: { type: 'call_permission_reply', call_permission_reply: { response: 'accept', is_permanent: false } },
    });
    assert.deepEqual(parsed, { type: 'call', body: 'Customer allowed calls for 7 days' });
});

test('reactions are ignored, location gets a placeholder', () => {
    assert.equal(parseIncoming({ ...base, type: 'reaction' }), null);
    assert.equal(parseIncoming({ ...base, type: 'location' })?.body, '[location message — open WhatsApp to view]');
});
