// Run with: node --import tsx --test src/lib/__tests__/keyed-queue.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInOrder, waitForKey } from '../keyed-queue.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('jobs of one key run one after another, never overlapping', async () => {
    const log: string[] = [];
    const slow = runInOrder('a', async () => {
        log.push('slow start');
        await sleep(40);
        log.push('slow end');
    });
    const fast = runInOrder('a', async () => {
        log.push('fast');
    });
    await Promise.all([slow, fast]);
    assert.deepEqual(log, ['slow start', 'slow end', 'fast']);
});

test('different keys do not wait for each other', async () => {
    const log: string[] = [];
    const a = runInOrder('x', async () => {
        await sleep(40);
        log.push('x');
    });
    const b = runInOrder('y', async () => {
        log.push('y');
    });
    await Promise.all([a, b]);
    assert.deepEqual(log, ['y', 'x']);
});

test('a failed job does not block the next one', async () => {
    const failing = runInOrder('f', async () => {
        throw new Error('boom');
    });
    await assert.rejects(failing);
    assert.equal(await runInOrder('f', async () => 'next'), 'next');
});

test('waitForKey waits for queued work but never longer than the limit', async () => {
    const job = runInOrder('w', () => sleep(30));
    const started = Date.now();
    await waitForKey('w', 1000);
    assert.ok(Date.now() - started >= 25);
    await job;
    const long = runInOrder('w2', () => sleep(300));
    const t0 = Date.now();
    await waitForKey('w2', 40);
    assert.ok(Date.now() - t0 < 200);
    await long;
    await waitForKey('nothing-queued', 1000);
});
