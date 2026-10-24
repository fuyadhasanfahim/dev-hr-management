// Run with: node --import tsx --test src/lib/__tests__/sales-flow.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asksPrice, isAckOnly, leaksPrice, priceGate } from '../sales-flow.js';

test('price questions in English, Bengali and Banglish are detected', () => {
    for (const m of ['What is the price?', 'how much for a store', 'দাম কত', 'এটার খরচ কত পড়বে', 'website er dam koto', 'koto taka lagbe', 'rate bolen'])
        assert.ok(asksPrice(m), m);
    for (const m of ['I need an e-commerce website', 'Shopify naki Laravel', 'ami product bechte chai'])
        assert.ok(!asksPrice(m), m);
});

test('prices are caught in the reply, plain words are not', () => {
    for (const r of ['The Starter package is BDT 25,000.', 'দাম ৳৩০,০০০ থেকে শুরু', '25000 টাকা', 'Starts at $500', '15,000 Tk', 'BDT25000'])
        assert.ok(leaksPrice(r), r);
    for (const r of ['It includes 5 pages and a payment gateway.', 'We deliver within 14 days.', 'আপনার কতগুলো প্রোডাক্ট থাকবে?', 'Next.js 15 and React 19'])
        assert.ok(!leaksPrice(r), r);
});

test('price gate: closed until a platform and its packages have been recommended', () => {
    assert.equal(priceGate(undefined, 'price?', []).allowed, false);
    assert.equal(priceGate('discover', 'dam koto', []).allowed, false);
    assert.equal(priceGate('platform', 'price koto', []).allowed, true);
    assert.equal(priceGate('features', 'price koto', []).allowed, true);
    assert.equal(priceGate('extras', 'ok, price?', []).allowed, true);
    assert.equal(priceGate('recap', 'koto?', []).allowed, true);
    assert.equal(priceGate('price', 'and the second package?', []).allowed, true);
});

test('price gate: opens when the customer insists a second time', () => {
    const history = [{ role: 'user', content: 'price koto?' }, { role: 'assistant', content: 'It depends on the platform…' }];
    assert.equal(priceGate('discover', 'dam ta bolen', history).allowed, true);
    assert.equal(priceGate('discover', 'ok shopify', history).allowed, false);
});

test('price gate: opens when a human teammate already took the customer through the package', () => {
    const human = [{ role: 'assistant', content: 'Next.js starter package ta nin', human: true }];
    assert.equal(priceGate('discover', 'price ki fixed', human).allowed, true);
    assert.equal(priceGate('discover', 'price ki fixed', [{ role: 'assistant', content: 'hi' }]).allowed, false);
});

test('acknowledgements need no reply, but "ok"/"yes" can answer a question', () => {
    for (const m of ['Thanks', 'welcome', 'Joined', '👍', 'ধন্যবাদ']) assert.ok(isAckOnly(m), m);
    for (const m of ['Ok', 'Yes', 'Hello', '?', 'price koto']) assert.ok(!isAckOnly(m), m);
});
