/**
 * parseHistoryThread: the app's past chats → rows the inbox imports.
 *
 * Run with: node --import tsx --test src/lib/__tests__/whatsapp-parse-history.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHistoryThread } from '../whatsapp-inbound.js';

const cust = '8801700000000';
const biz = '8801977201923';

test('direction, time and delivery status come from the thread', () => {
    const rows = parseHistoryThread({
        id: cust,
        messages: [
            { from: cust, id: 'a', timestamp: '1700000000', type: 'text', text: { body: 'hi' } },
            { from: biz, to: cust, id: 'b', timestamp: '1700000060', type: 'text', text: { body: 'hello' }, history_context: { status: 'READ' } },
            { from: biz, to: cust, id: 'c', timestamp: '1700000120', type: 'text', text: { body: 'x' } },
        ],
    });
    assert.deepEqual(rows.map((r) => [r.whatsappMsgId, r.direction, r.status]), [
        ['a', 'inbound', undefined],
        ['b', 'outbound', 'read'],
        ['c', 'outbound', 'sent'],
    ]);
    assert.equal(rows[0]!.at.getTime(), 1700000000_000);
});

test('media placeholders become a text stub; unreadable messages are skipped', () => {
    const rows = parseHistoryThread({
        id: cust,
        messages: [
            { from: cust, id: 'm', timestamp: '1', type: 'media_placeholder' },
            { from: cust, id: 'r', timestamp: '2', type: 'reaction' },
            { from: cust, timestamp: '3', type: 'text', text: { body: 'no id' } } as never,
        ],
    });
    assert.equal(rows.length, 1);
    assert.match(rows[0]!.content.body, /media message/);
});
