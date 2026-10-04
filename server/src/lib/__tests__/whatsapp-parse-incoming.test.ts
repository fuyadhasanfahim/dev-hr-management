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

test('username sender: no phone, falls back to BSUID', async () => {
    const { senderId, isPhoneId } = await import('../whatsapp-inbound.js');
    assert.equal(senderId({ from: '8801700000000', from_user_id: 'BD.123' }), '8801700000000');
    assert.equal(senderId({ from_user_id: 'BD.13491208655302741918' }), 'BD.13491208655302741918');
    assert.equal(senderId({}), undefined);
    assert.ok(isPhoneId('8801700000000'));
    assert.ok(!isPhoneId('BD.13491208655302741918'));
});

test('outbound payload: phone → to, BSUID → recipient', async () => {
    process.env.NODE_ENV ??= 'test';
    const { default: svc } = await import('../../services/whatsapp.service.js');
    const bodies: any[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_u: any, init: any) => {
        bodies.push(JSON.parse(init.body));
        return { ok: true, json: async () => ({ messages: [{ id: 'x' }] }) };
    }) as any;
    try {
        await svc.sendTextMessage('8801700000000', 'hi');
        await svc.sendTextMessage('BD.123', 'hi');
    } finally {
        globalThis.fetch = realFetch;
    }
    assert.equal(bodies[0].to, '8801700000000');
    assert.equal(bodies[0].recipient, undefined);
    assert.equal(bodies[1].recipient, 'BD.123');
    assert.equal(bodies[1].to, undefined);
});
