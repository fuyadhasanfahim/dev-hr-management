import { apiSlice } from '@/redux/api/apiSlice';
import type { CatalogEntity, CatalogEntityMap, CatalogGraph, CatalogPagination, CatalogTreeService } from '@/types/catalog.type';

type Doc = Record<string, unknown>;

/** One set of endpoints for the four catalog modules (services / platforms / packages / features). */
export const catalogApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getCatalogTree: builder.query<CatalogTreeService[], void>({
            query: () => '/catalog/tree',
            transformResponse: (r: { data: CatalogTreeService[] }) => r.data,
            providesTags: ['Catalog'],
        }),
        /** Server-side page + search. `params.all = true` returns everything (dropdown sources). */
        getCatalogItems: builder.query<
            { items: CatalogEntityMap[CatalogEntity][]; pagination: CatalogPagination },
            { entity: CatalogEntity; params?: Doc }
        >({
            query: ({ entity, params }) => ({ url: `/catalog/${entity}`, params }),
            transformResponse: (r: { data: CatalogEntityMap[CatalogEntity][]; pagination: CatalogPagination }) => ({
                items: r.data,
                pagination: r.pagination,
            }),
            providesTags: ['Catalog'],
        }),
        /** Everything the canvas draws (inactive included) + saved node positions. */
        getCatalogGraph: builder.query<CatalogGraph, void>({
            query: () => '/catalog/graph',
            transformResponse: (r: { data: CatalogGraph }) => r.data,
            providesTags: ['Catalog'],
        }),
        /** Node positions are saved silently — no refetch, so dragging never re-renders the board. */
        saveCatalogLayout: builder.mutation<unknown, { positions: Record<string, { x: number; y: number }> }>({
            query: (body) => ({ url: '/catalog/layout', method: 'PUT', body }),
        }),
        duplicateCatalogItem: builder.mutation<unknown, { entity: 'packages' | 'sections'; id: string; body: Doc }>({
            query: ({ entity, id, body }) => ({ url: `/catalog/${entity}/${id}/duplicate`, method: 'POST', body }),
            invalidatesTags: ['Catalog'],
        }),
        createCatalogItem: builder.mutation<{ _id: string } & Doc, { entity: CatalogEntity; body: Doc }>({
            query: ({ entity, body }) => ({ url: `/catalog/${entity}`, method: 'POST', body }),
            transformResponse: (r: { data: { _id: string } & Doc }) => r.data,
            invalidatesTags: ['Catalog'],
        }),
        updateCatalogItem: builder.mutation<{ _id: string } & Doc, { entity: CatalogEntity; id: string; body: Doc }>({
            query: ({ entity, id, body }) => ({ url: `/catalog/${entity}/${id}`, method: 'PATCH', body }),
            transformResponse: (r: { data: { _id: string } & Doc }) => r.data,
            invalidatesTags: ['Catalog'],
        }),
        toggleCatalogItem: builder.mutation<unknown, { entity: CatalogEntity; id: string }>({
            query: ({ entity, id }) => ({ url: `/catalog/${entity}/${id}/toggle-status`, method: 'PATCH' }),
            invalidatesTags: ['Catalog'],
        }),
        deleteCatalogItem: builder.mutation<unknown, { entity: CatalogEntity; id: string }>({
            query: ({ entity, id }) => ({ url: `/catalog/${entity}/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Catalog'],
        }),
    }),
});

export const {
    useGetCatalogTreeQuery,
    useGetCatalogGraphQuery,
    useSaveCatalogLayoutMutation,
    useDuplicateCatalogItemMutation,
    useGetCatalogItemsQuery,
    useCreateCatalogItemMutation,
    useUpdateCatalogItemMutation,
    useToggleCatalogItemMutation,
    useDeleteCatalogItemMutation,
} = catalogApi;
