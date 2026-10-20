/** Schedule evaluation for the AI control page (pure — no DB). Run: npx tsx --test src/services/__tests__/ai-settings.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAt } from '../ai-settings.service.js';

const base: any = {
    key: 'global',
    masterMode: 'on',
    timezone: 'Asia/Dhaka', // UTC+6, no DST
    features: { whatsapp: { enabled: true }, web_chat: { enabled: true }, chat_summary: { enabled: true } },
    autoResume: { enabled: true, minutes: 5 },
    pauseOnAgentReply: true,
    schedules: [],
};
const rule = (o: any) => ({ id: 'x', label: 'r', enabled: true, features: [], days: [], action: 'off_during', ...o });
const at = (iso: string) => new Date(iso); // Dhaka = UTC+6

test('master off beats everything', () => {
    assert.equal(evaluateAt({ ...base, masterMode: 'off' }, 'whatsapp', new Date()).reason, 'master');
});

test('per-feature switch', () => {
    const s = { ...base, features: { ...base.features, web_chat: { enabled: false } } };
    assert.equal(evaluateAt(s, 'web_chat', new Date()).active, false);
    assert.equal(evaluateAt(s, 'whatsapp', new Date()).active, true);
});

test('daily overnight window 22:00-09:00 Dhaka', () => {
    const s = { ...base, schedules: [rule({ kind: 'daily', startTime: '22:00', endTime: '09:00' })] };
    assert.equal(evaluateAt(s, 'whatsapp', at('2026-10-20T17:00:00Z')).active, false); // 23:00 Dhaka
    assert.equal(evaluateAt(s, 'whatsapp', at('2026-10-20T01:00:00Z')).active, false); // 07:00 Dhaka
    assert.equal(evaluateAt(s, 'whatsapp', at('2026-10-20T06:00:00Z')).active, true); // 12:00 Dhaka
});

test('weekly all-day Friday (2026-10-23 is a Friday)', () => {
    const s = { ...base, schedules: [rule({ kind: 'weekly', days: [5], startTime: '00:00', endTime: '00:00' })] };
    assert.equal(evaluateAt(s, 'whatsapp', at('2026-10-23T06:00:00Z')).active, false);
    assert.equal(evaluateAt(s, 'whatsapp', at('2026-10-22T06:00:00Z')).active, true);
});

test('monthly last day, one-off range, and only_on hours', () => {
    const monthly = { ...base, schedules: [rule({ kind: 'monthly', days: [0], startTime: '00:00', endTime: '00:00' })] };
    assert.equal(evaluateAt(monthly, 'whatsapp', at('2026-10-31T06:00:00Z')).active, false);
    assert.equal(evaluateAt(monthly, 'whatsapp', at('2026-10-30T06:00:00Z')).active, true);

    const once = { ...base, schedules: [rule({ kind: 'once', startAt: at('2026-10-20T00:00:00Z'), endAt: at('2026-10-21T00:00:00Z') })] };
    assert.equal(evaluateAt(once, 'whatsapp', at('2026-10-20T12:00:00Z')).active, false);
    assert.equal(evaluateAt(once, 'whatsapp', at('2026-10-21T00:00:00Z')).active, true);

    const hours = { ...base, schedules: [rule({ kind: 'daily', action: 'only_on', startTime: '10:00', endTime: '18:00' })] };
    assert.equal(evaluateAt(hours, 'whatsapp', at('2026-10-20T06:00:00Z')).active, true); // 12:00
    assert.equal(evaluateAt(hours, 'whatsapp', at('2026-10-20T14:00:00Z')).reason, 'outside_hours'); // 20:00
});

test('schedule limited to one feature leaves the others on', () => {
    const s = { ...base, schedules: [rule({ kind: 'daily', features: ['web_chat'], startTime: '00:00', endTime: '00:00' })] };
    assert.equal(evaluateAt(s, 'web_chat', new Date()).active, false);
    assert.equal(evaluateAt(s, 'whatsapp', new Date()).active, true);
});
