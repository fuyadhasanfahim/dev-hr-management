// Run with: node --import tsx --test src/services/__tests__/currency-policy.test.ts
// Needs server/.env (env.config validates it on import). No database, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoneyCode, normalizeCurrencyCode } from '../../utils/money.util.js';
import { BDT_NO_ONLINE_PAYMENT, isOnlinePayable, normalizeCurrencyForGateway, resolveGatewayCharge, toStripeMinorUnits } from '../payment.service.js';

test('money is written with the ISO code, never a symbol', () => {
    assert.equal(formatMoneyCode(1200, 'USD'), 'USD 1,200.00');
    assert.equal(formatMoneyCode(950.5, 'EUR'), 'EUR 950.50');
    assert.equal(formatMoneyCode(80, 'GBP'), 'GBP 80.00');
    assert.equal(formatMoneyCode(100000, 'BDT'), 'BDT 1,00,000.00'); // BDT keeps Indian grouping
    assert.equal(formatMoneyCode(15000, 'BDT', 0), 'BDT 15,000');
    for (const out of [formatMoneyCode(1, 'USD'), formatMoneyCode(1, 'EUR'), formatMoneyCode(1, '৳'), formatMoneyCode(1, '$')]) {
        assert.doesNotMatch(out, /[$€£৳]/);
    }
});

test('legacy symbols and messy values normalise to a code', () => {
    assert.equal(normalizeCurrencyCode('$'), 'USD');
    assert.equal(normalizeCurrencyCode('€'), 'EUR');
    assert.equal(normalizeCurrencyCode('£'), 'GBP');
    assert.equal(normalizeCurrencyCode('৳'), 'BDT');
    assert.equal(normalizeCurrencyCode(' Tk '), 'BDT');
    assert.equal(normalizeCurrencyCode('eur'), 'EUR');
    assert.equal(normalizeCurrencyCode(''), 'BDT');
    assert.equal(normalizeCurrencyCode(undefined), 'BDT');
    assert.equal(normalizeCurrencyCode(null), 'BDT');
});

test('amounts that are empty, NaN or whole numbers still format', () => {
    assert.equal(formatMoneyCode(undefined, 'USD'), 'USD 0.00');
    assert.equal(formatMoneyCode(NaN, 'EUR'), 'EUR 0.00');
    assert.equal(formatMoneyCode(1500, 'USD', 'auto'), 'USD 1,500');
    assert.equal(formatMoneyCode(1500.5, 'USD', 'auto'), 'USD 1,500.50');
});

test('BDT can never be paid online; every other currency can', () => {
    for (const c of ['BDT', 'bdt', ' BDT ', '৳', 'Tk', 'tk', '', undefined, null]) assert.equal(isOnlinePayable(c), false, String(c));
    for (const c of ['USD', 'usd', '$', 'EUR', '€', 'GBP', '£', 'AUD', 'CAD']) assert.equal(isOnlinePayable(c), true, c);
});

test('gateway charges the invoice own currency unchanged (no conversion), BDT is refused', async () => {
    const base = { amountDue: 123.45 } as never;
    for (const [cur, code] of [['USD', 'usd'], ['EUR', 'eur'], ['€', 'eur'], ['GBP', 'gbp'], ['$', 'usd']] as const) {
        const c = await resolveGatewayCharge({ ...(base as object), currency: cur } as never);
        assert.deepEqual(c, { chargeCurrency: code, chargeAmount: 123.45, fxRate: 1 }, cur);
    }
    await assert.rejects(() => resolveGatewayCharge({ ...(base as object), currency: 'BDT' } as never), (e: any) => e.statusCode === 422 && e.message === BDT_NO_ONLINE_PAYMENT);
    await assert.rejects(() => resolveGatewayCharge({ ...(base as object), currency: '৳' } as never), /BDT/);
});

test('stripe minor units for EUR / GBP / USD', () => {
    assert.equal(toStripeMinorUnits(10.5, normalizeCurrencyForGateway('EUR')), 1050);
    assert.equal(toStripeMinorUnits(0.1 + 0.2, normalizeCurrencyForGateway('GBP')), 30);
    assert.equal(toStripeMinorUnits(19.99, normalizeCurrencyForGateway('USD')), 1999);
});
