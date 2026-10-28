// Run with: node --import tsx --test src/lib/__tests__/openai-chat.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonReply } from '../openai-chat.js';

const wrap = (content: unknown) => ({ choices: [{ message: { content } }] });

test('a normal JSON reply is parsed', () => {
    assert.deepEqual(parseJsonReply(wrap('{"reply":"hi","escalate":false}')), { reply: 'hi', escalate: false });
});

test('null content (refusal / filtered answer) becomes {} instead of crashing on null.reply', () => {
    assert.deepEqual(parseJsonReply(wrap(null)), {});
    assert.deepEqual(parseJsonReply({ choices: [{ message: { refusal: 'no', content: null } }] }), {});
});

test('empty, malformed, non-object and missing responses become {}', () => {
    for (const bad of ['', '   ', 'not json', '{"reply":', 'null', '[1,2]', '"text"', '42'] as const) assert.deepEqual(parseJsonReply(wrap(bad)), {}, bad);
    assert.deepEqual(parseJsonReply(undefined), {});
    assert.deepEqual(parseJsonReply({}), {});
    assert.deepEqual(parseJsonReply({ choices: [] }), {});
});
