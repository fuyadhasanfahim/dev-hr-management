export const PAGE_SIZES = [20, 50, 100] as const;

export interface PageParams {
    page: number;
    limit: number;
    offset: number;
}

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/** Reads ?page & ?limit from a query string. Limit snaps to 20 / 50 / 100 (default 20). */
export function parsePage(query: Record<string, unknown>): PageParams {
    const page = Math.max(1, Math.floor(Number(one(query.page))) || 1);
    const asked = Math.floor(Number(one(query.limit)));
    const limit = (PAGE_SIZES as readonly number[]).includes(asked) ? asked : PAGE_SIZES[0];
    return { page, limit, offset: (page - 1) * limit };
}

export function pageMeta({ page, limit }: PageParams, total: number) {
    return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** `%term%` for ILIKE with LIKE wildcards escaped, or null when there is no search term. */
export function likePattern(q: unknown): string | null {
    const term = typeof one(q) === 'string' ? (one(q) as string).trim().slice(0, 100) : '';
    return term ? `%${term.replace(/[\\%_]/g, '\\$&')}%` : null;
}
