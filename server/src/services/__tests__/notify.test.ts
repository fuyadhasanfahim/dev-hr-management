// Run with: node --import tsx --test src/services/__tests__/notify.test.ts
// Needs server/.env (env.config validates it on import). No database, no network: fetch is replaced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import envConfig from '../../config/env.config.js';
import { notify } from '../notify.service.js';
import { orderStatusText } from '../order-notify.service.js';
import { isBdMobile, toWhatsAppNumber } from '../../utils/phone.util.js';

const notice = { event: 'test', subject: 'Order X: delivered', text: 'Your order X has been delivered.' };

test('dry mode sends nothing and still resolves', async () => {
    envConfig.notify_mode = 'dry';
    const r = await notify({ name: 'Rahim', phone: '01711111111', email: 'a@b.com' }, notice);
    assert.match(r.sms, /^skipped/);
    assert.match(r.whatsapp, /^skipped/);
    assert.match(r.email, /^skipped/);
});

test('live mode: every channel failing is reported, never thrown', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
        throw new Error('network down');
    }) as typeof fetch;
    try {
        envConfig.notify_mode = 'live';
        envConfig.sms_api_key = 'test-key';
        envConfig.meta_access_token = 'test-token';
        envConfig.whatsapp_phone_number_id = '123';
        const r = await notify(
            { name: 'Rahim', phone: '01711111111', email: null },
            { ...notice, whatsappTemplate: { name: 'order_status', params: ['Rahim', 'X', 'delivered'] } },
        );
        assert.match(r.sms, /^failed/);
        assert.match(r.whatsapp, /^failed/);
        assert.match(r.email, /^skipped/);
    } finally {
        globalThis.fetch = realFetch;
        envConfig.notify_mode = 'dry';
    }
});

test('missing or foreign phone numbers skip SMS instead of failing', async () => {
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
        calls++;
        return new Response('{}');
    }) as typeof fetch;
    try {
        envConfig.notify_mode = 'live';
        envConfig.sms_api_key = 'test-key';
        envConfig.meta_access_token = '';
        const none = await notify({ name: 'A', phone: null }, notice);
        const foreign = await notify({ name: 'B', phone: '+1 415 555 0100' }, notice);
        assert.match(none.sms, /^skipped/);
        assert.match(foreign.sms, /^skipped/);
        assert.equal(calls, 0);
    } finally {
        globalThis.fetch = realFetch;
        envConfig.notify_mode = 'dry';
    }
});

test('SMS goes out as 8801… and a 202 from the gateway counts as sent', async () => {
    const realFetch = globalThis.fetch;
    let body: any;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ response_code: 202, success_message: 'SMS Submitted Successfully' }));
    }) as typeof fetch;
    try {
        envConfig.notify_mode = 'live';
        envConfig.sms_api_key = 'test-key';
        envConfig.meta_access_token = '';
        const r = await notify({ name: 'A', phone: '01711111111' }, notice);
        assert.equal(r.sms, 'sent');
        assert.equal(body.number, '8801711111111');
        assert.equal(body.type, 'text');
    } finally {
        globalThis.fetch = realFetch;
        envConfig.notify_mode = 'dry';
    }
});

test('phone helpers and status wording', () => {
    assert.equal(toWhatsAppNumber('01711-111111'), '8801711111111');
    assert.equal(isBdMobile(toWhatsAppNumber('+880 1711 111111')), true);
    assert.equal(isBdMobile(toWhatsAppNumber('+14155550100')), false);
    assert.match(orderStatusText('ORD-1', 'delivered'), /ORD-1.*delivered/);
    assert.match(orderStatusText('ORD-1', 'some_new_status'), /some new status/);
});
