import { apiSlice } from '@/redux/api/apiSlice';
import type { CatalogEntity, CatalogEntityMap, CatalogPagination, CatalogTreeService } from '@/types/catalog.type';

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
        createCatalogItem: builder.mutation<unknown, { entity: CatalogEntity; body: Doc }>({
            query: ({ entity, body }) => ({ url: `/catalog/${entity}`, method: 'POST', body }),
            invalidatesTags: ['Catalog'],
        }),
        updateCatalogItem: builder.mutation<unknown, { entity: CatalogEntity; id: string; body: Doc }>({
            query: ({ entity, id, body }) => ({ url: `/catalog/${entity}/${id}`, method: 'PATCH', body }),
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
    useGetCatalogItemsQuery,
    useCreateCatalogItemMutation,
    useUpdateCatalogItemMutation,
    useToggleCatalogItemMutation,
    useDeleteCatalogItemMutation,
} = catalogApi;
