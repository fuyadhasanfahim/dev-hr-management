/**
 * Field-masking policy for orders / quotations.
 *
 * Run: node --import tsx --test src/utils/__tests__/masking.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { maskOrder, maskQuotation } from '../masking.js';

const fullViewer = { permissions: ['order.viewFinancials', 'order.viewClient'] };
const moneyOnly = { permissions: ['order.viewFinancials'] };
const clientOnly = { permissions: ['order.viewClient'] };
const nobody = { permissions: ['order.read'] };
const superuser = { permissions: ['*'] };

const order = () => ({
    _id: 'o1',
    status: 'active',
    clientId: 'c1',
    clientName: 'ACME Ltd',
    clientEmail: 'buyer@acme.test',
    clientRequirements: ['fast'],
    totalAmount: 5000,
    grandTotal: 5000,
    paymentPhases: {
        upfront: { amountDue: 2000, amountPaid: 2000 },
        delivery: { amountDue: 2000, amountPaid: 0 },
        final: { amountDue: 1000, amountPaid: 0 },
    },
    quotationSnapshot: {
        clientName: 'ACME Ltd',
        clientEmail: 'buyer@acme.test',
        grandTotal: 5000,
        services: [{ name: 'Web', basePrice: 5000, lineItems: [{ label: 'x', price: 5000 }] }],
    },
});

const quotation = () => ({
    _id: 'q1',
    company: { name: 'Us Inc' },
    client: { contactName: 'Jane', email: 'jane@acme.test' },
    clientId: 'c1',
    clientRequirements: ['fast'],
    totals: { subtotal: 5000, grandTotal: 5000 },
    services: [{ name: 'Web', basePrice: 5000 }],
});

describe('maskOrder', () => {
    test('full viewer gets the untouched object', () => {
        assert.equal(maskOrder(order(), fullViewer).totalAmount, 5000);
        assert.equal(maskOrder(order(), superuser).clientName, 'ACME Ltd');
    });

    test('no permissions -> both money and client stripped', () => {
        const out = maskOrder(order(), nobody);
        assert.equal(out.totalAmount, undefined);
        assert.equal(out.grandTotal, undefined);
        assert.equal(out.paymentPhases.upfront.amountDue, undefined);
        assert.equal(out.clientName, undefined);
        assert.equal(out.clientEmail, undefined);
        assert.equal(out.clientId, undefined);
        assert.equal(out.clientRequirements, undefined);
        assert.equal(out.quotationSnapshot.clientName, undefined);
        assert.equal(out.quotationSnapshot.grandTotal, undefined);
        assert.equal(out.isFinancialsMasked, true);
        assert.equal(out.isClientMasked, true);
        // progress % is still derivable
        assert.equal(out.paymentPhases.totalPercentage, 40);
    });

    test('viewFinancials only -> keeps money, strips client', () => {
        const out = maskOrder(order(), moneyOnly);
        assert.equal(out.totalAmount, 5000);
        assert.equal(out.clientName, undefined);
        assert.equal(out.isClientMasked, true);
        assert.equal(out.isFinancialsMasked, undefined);
    });

    test('viewClient only -> keeps client, strips money', () => {
        const out = maskOrder(order(), clientOnly);
        assert.equal(out.clientName, 'ACME Ltd');
        assert.equal(out.totalAmount, undefined);
        assert.equal(out.isFinancialsMasked, true);
    });
});

describe('maskQuotation', () => {
    test('no permissions -> client + totals stripped, company kept', () => {
        const out = maskQuotation(quotation(), nobody);
        assert.equal(out.client, undefined);
        assert.equal(out.clientId, undefined);
        assert.equal(out.totals.grandTotal, undefined);
        assert.equal(out.services[0].basePrice, undefined);
        assert.equal(out.company.name, 'Us Inc');
    });

    test('full viewer untouched', () => {
        assert.equal(maskQuotation(quotation(), fullViewer).totals.grandTotal, 5000);
    });
});
