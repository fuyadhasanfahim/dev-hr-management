/**
 * Unit tests for E1-F3-T1: closing the Receipt zero-payment check-then-create
 * race in `ReceiptService.createZeroPaymentReceipt`.
 *
 * Scope note: the backlog's specified testing strategy is a concurrent-call
 * test (`Promise.all` of two simultaneous creations against a live,
 * unique-indexed MongoDB) asserting exactly one receipt persists. That
 * requires a real (or in-memory) MongoDB — this sandbox has no network path
 * to one and no DB test harness exists yet (E7-F1-T1's explicit scope), the
 * same documented limitation as every prior DB-touching task this session.
 *
 * Instead, this suite exercises the actual catch-and-retry logic added to
 * `createZeroPaymentReceipt` by monkey-patching `ReceiptModel.findOne` /
 * `ReceiptModel.prototype.save` / `InvoiceCounter.findByIdAndUpdate` to
 * deterministically reproduce the exact sequence a real race produces: the
 * pre-save existence check finds nothing, the save then fails with a Mongo
 * E11000 (which the new unique index on quotationGroupId would raise for a
 * true concurrent winner), and the function must resolve idempotently to the
 * winning document rather than throwing. This proves the application-level
 * half of the fix; the unique index itself (the DB-level half) is verified
 * by direct inspection of `receipt.model.ts` and cannot be exercised without
 * a real MongoDB in this environment — flagged as an open follow-up for
 * whoever can run this against a real database before production rollout.
 *
 * Run with: node --import tsx --test src/services/__tests__/receipt-zero-payment-race.test.ts
 * (run from the `server/` directory)
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ReceiptService } from '../receipt.service.js';
import ReceiptModel from '../../models/receipt.model.js';
import { InvoiceCounter } from '../../models/invoice-counter.model.js';

const VALID_OBJECT_ID = '507f1f77bcf86cd799439011';
const VALID_USER_ID = '507f191e810c19729de860ea';

function makeQuotation(overrides: Record<string, unknown> = {}) {
    return {
        _id: VALID_OBJECT_ID,
        quotationGroupId: 'grp-race-test',
        quotationNumber: 'QTN-2026-0099',
        clientId: undefined,
        client: { contactName: 'Race Test Client' },
        details: { title: 'Race Test Project' },
        services: [{ category: 'web-development' }],
        currency: '৳',
        ...overrides,
    };
}

function duplicateKeyError() {
    const err: any = new Error('E11000 duplicate key error collection: receipts index: quotationGroupId_1');
    err.code = 11000;
    return err;
}

describe('ReceiptService.createZeroPaymentReceipt — zero-payment race (E1-F3-T1)', () => {
    let originalFindOne: typeof ReceiptModel.findOne;
    let originalSave: typeof ReceiptModel.prototype.save;
    let originalCounterUpdate: typeof InvoiceCounter.findByIdAndUpdate;

    beforeEach(() => {
        originalFindOne = ReceiptModel.findOne;
        originalSave = ReceiptModel.prototype.save;
        originalCounterUpdate = InvoiceCounter.findByIdAndUpdate;
        (InvoiceCounter as any).findByIdAndUpdate = async () => ({ seq: 1 });
    });

    afterEach(() => {
        ReceiptModel.findOne = originalFindOne;
        ReceiptModel.prototype.save = originalSave;
        (InvoiceCounter as any).findByIdAndUpdate = originalCounterUpdate;
    });

    test('concurrent-write race: save() hits E11000, resolves idempotently to the concurrent winner instead of throwing', async () => {
        let findOneCalls = 0;
        const winner = { _id: 'winner-receipt-id', quotationGroupId: 'grp-race-test' };

        (ReceiptModel as any).findOne = async (_query: unknown) => {
            findOneCalls++;
            // 1st call: the pre-save existence check — sees nothing yet (the
            // race window).
            if (findOneCalls === 1) return null;
            // 2nd call: the post-catch idempotent lookup — the concurrent
            // request has since won and its receipt is now visible.
            return winner;
        };
        ReceiptModel.prototype.save = async function () {
            throw duplicateKeyError();
        };

        const result = await ReceiptService.createZeroPaymentReceipt(makeQuotation(), VALID_USER_ID);

        assert.equal(result, winner, 'must return the concurrent winner, not throw');
        assert.equal(findOneCalls, 2, 'must re-query exactly once after the duplicate-key catch');
    });

    test('non-duplicate-key save errors are not swallowed by the race handling', async () => {
        (ReceiptModel as any).findOne = async () => null;
        const dbDownError = new Error('connection reset by peer');
        ReceiptModel.prototype.save = async function () {
            throw dbDownError;
        };

        await assert.rejects(
            () => ReceiptService.createZeroPaymentReceipt(makeQuotation(), VALID_USER_ID),
            (err: unknown) => {
                assert.equal(err, dbDownError, 'unrelated errors must propagate unchanged, not be masked as a race');
                return true;
            },
        );
    });

    test('happy path (no race): save() succeeds normally, is not retried, and the new document is returned directly', async () => {
        let findOneCalls = 0;
        let saveCalls = 0;
        (ReceiptModel as any).findOne = async () => {
            findOneCalls++;
            return null;
        };
        ReceiptModel.prototype.save = async function () {
            saveCalls++;
            return this;
        };

        const result: any = await ReceiptService.createZeroPaymentReceipt(makeQuotation(), VALID_USER_ID);

        assert.equal(findOneCalls, 1, 'no race means only the initial existence check runs');
        assert.equal(saveCalls, 1);
        assert.equal(result.quotationGroupId, 'grp-race-test');
    });

    test('pre-existing behavior unaffected: an already-existing receipt short-circuits before any save is attempted', async () => {
        const existing = { _id: 'already-there', quotationGroupId: 'grp-race-test' };
        let saveCalls = 0;
        (ReceiptModel as any).findOne = async () => existing;
        ReceiptModel.prototype.save = async function () {
            saveCalls++;
            return this;
        };

        const result = await ReceiptService.createZeroPaymentReceipt(makeQuotation(), VALID_USER_ID);

        assert.equal(result, existing);
        assert.equal(saveCalls, 0, 'the pre-existing early-return path must not attempt a save at all');
    });
});
