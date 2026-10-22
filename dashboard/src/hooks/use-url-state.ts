'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/components/ui/pagination-bar';

type Patch = Record<string, string | number | null | undefined>;

/**
 * List state that lives in the URL (?tab=gaps&q=price&page=3&limit=50), so refresh, back/forward
 * and shared links land on the same view. Defaults are left out of the URL. Needs a <Suspense> parent.
 */
export function useUrlState(defaults: Record<string, string> = {}) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const query = params.toString();

    const get = useCallback((key: string) => params.get(key) ?? defaults[key] ?? '', [params, defaults]);

    const set = useCallback(
        (patch: Patch) => {
            const next = new URLSearchParams(query);
            for (const [key, value] of Object.entries(patch)) {
                if (value == null || value === '' || String(value) === (defaults[key] ?? '')) next.delete(key);
                else next.set(key, String(value));
            }
            const qs = next.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        },
        [query, defaults, router, pathname],
    );

    return { get, set };
}

/** page + limit from the URL, validated: page ≥ 1, limit one of the allowed sizes. */
export function readPaging(get: (key: string) => string) {
    const page = Math.max(1, Math.floor(Number(get('page'))) || 1);
    const asked = Number(get('limit'));
    const limit = PAGE_SIZE_OPTIONS.includes(asked) ? asked : DEFAULT_PAGE_SIZE;
    return { page, limit };
}

/** After a delete empties the last page, step back to the new last page instead of showing "no results". */
export function useClampPage(page: number, totalPages: number | undefined, setPage: (page: number) => void) {
    useEffect(() => {
        if (totalPages && page > totalPages) setPage(totalPages);
    }, [page, totalPages, setPage]);
}
