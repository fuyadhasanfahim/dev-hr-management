// Run with: node --import tsx --test src/lib/__tests__/whatsapp-reply-guard.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideSend, MAX_REDOS, type SendCheck } from '../whatsapp-reply-guard.js';

const t = (s: string) => new Date(`2026-10-28T10:00:${s}Z`);
const ok: SendCheck = { botActive: true, aiActive: true, answeredUpTo: t('10'), redos: 0 };

test('nothing changed while the reply was written: send', () => {
    assert.equal(decideSend(ok).action, 'send');
    assert.equal(decideSend({ ...ok, humanRepliedAt: t('05'), newestCustomerAt: t('10') }).action, 'send');
});

test('a teammate replied after the customer message: do not send', () => {
    const d = decideSend({ ...ok, humanRepliedAt: t('15') });
    assert.equal(d.action, 'skip');
    assert.match(d.why, /teammate/);
});

test('AI switched off, chat handed over, or admin switch off: do not send', () => {
    assert.equal(decideSend({ ...ok, botActive: false }).action, 'skip');
    assert.equal(decideSend({ ...ok, aiActive: false }).action, 'skip');
});

test('customer wrote again meanwhile: throw the draft away and answer once, together', () => {
    assert.equal(decideSend({ ...ok, newestCustomerAt: t('20') }).action, 'redo');
});

test('a customer who keeps typing still gets an answer after MAX_REDOS drafts', () => {
    assert.equal(decideSend({ ...ok, newestCustomerAt: t('20'), redos: MAX_REDOS }).action, 'send');
});

test('a teammate reply wins over a redo', () => {
    assert.equal(decideSend({ ...ok, humanRepliedAt: t('30'), newestCustomerAt: t('20') }).action, 'skip');
});
