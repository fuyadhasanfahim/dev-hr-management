/**
 * Run with: node --import tsx --test ../dashboard/src/components/quotation/document/__tests__/paginate.test.ts
 * (run from the `server/` directory — the dashboard has no test runner of its own)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paginate, type PBlock } from '../paginate';

const cap = () => 100;

describe('paginate', () => {
    test('packs blocks until the page is full, then starts a new page', () => {
        const blocks: PBlock[] = [{ h: 40 }, { h: 40 }, { h: 40 }, { h: 40 }, { h: 40 }];
        assert.deepEqual(paginate(blocks, cap), [[0, 1], [2, 3], [4]]);
    });

    test('keepWithNext moves a heading together with the block after it', () => {
        const blocks: PBlock[] = [{ h: 80 }, { h: 15, keepWithNext: true }, { h: 30 }];
        assert.deepEqual(paginate(blocks, cap), [[0], [1, 2]]);
    });

    test('a chain of keepWithNext blocks (chapter + card head + first row) moves together', () => {
        const blocks: PBlock[] = [{ h: 60 }, { h: 15, keepWithNext: true }, { h: 15, keepWithNext: true }, { h: 20 }];
        assert.deepEqual(paginate(blocks, cap), [[0], [1, 2, 3]]);
    });

    test('a table header row is repeated when the table continues on the next page', () => {
        const blocks: PBlock[] = [
            { h: 20, table: 't', head: true, keepWithNext: true },
            { h: 40, table: 't' },
            { h: 40, table: 't' },
            { h: 40, table: 't' },
        ];
        assert.deepEqual(paginate(blocks, cap), [[0, 1, 2], [0, 3]]);
    });

    test('an oversized block still gets its own page', () => {
        assert.deepEqual(paginate([{ h: 30 }, { h: 500 }, { h: 30 }], cap), [[0], [1], [2]]);
    });

    test('capacity can differ per page', () => {
        const blocks: PBlock[] = [{ h: 60 }, { h: 60 }, { h: 60 }];
        assert.deepEqual(paginate(blocks, (p) => (p === 0 ? 70 : 130)), [[0], [1, 2]]);
    });
});
