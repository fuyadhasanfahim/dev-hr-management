/**
 * Greedy A4 pagination. Each block is measured once (height in px) and packed top to bottom.
 * - keepWithNext: a heading is never left alone at the bottom of a page.
 * - table / head: when a table continues onto a new page its header row is repeated.
 * Oversized blocks are placed on a page of their own rather than dropped.
 */
export interface PBlock {
    h: number;
    keepWithNext?: boolean;
    /** Table id this block belongs to (header row and body rows share it). */
    table?: string;
    /** This block is the table's header row. */
    head?: boolean;
}

/** Returns, per page, the indices of the blocks placed on it (a repeated header appears again). */
export function paginate(blocks: PBlock[], cap: (page: number) => number): number[][] {
    const headOf = new Map<string, number>();
    blocks.forEach((b, i) => {
        if (b.head && b.table) headOf.set(b.table, i);
    });

    const pages: number[][] = [[]];
    let used = 0;
    blocks.forEach((b, i) => {
        const p = pages.length - 1;
        const next = blocks[i + 1];
        const need = b.keepWithNext && next ? b.h + next.h : b.h;
        if (pages[p]!.length > 0 && used + need > cap(p)) {
            pages.push([]);
            used = 0;
            const head = b.table && !b.head && blocks[i - 1]?.table === b.table ? headOf.get(b.table) : undefined;
            if (head !== undefined) {
                pages[pages.length - 1]!.push(head);
                used += blocks[head]!.h;
            }
        }
        pages[pages.length - 1]!.push(i);
        used += b.h;
    });
    return pages;
}
