import { apiSlice } from '@/redux/api/apiSlice';
import type {
    EarningsResponse,
    EarningResponse,
    EarningStatsResponse,
    EarningFilters,
    YearsResponse,
} from '@/types/earning.type';

/**
 * Earnings are fully derived from Receipt payments — this API is read-only.
 * Record or void a payment on a Receipt to change an Earning.
 */
const earningApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getEarnings: builder.query<EarningsResponse, EarningFilters>({
            query: (params) => ({
                url: '/earnings',
                params,
            }),
            providesTags: (result) =>
                result?.data
                    ? [
                          ...result.data.map(({ _id }) => ({
                              type: 'Earning' as const,
                              id: _id,
                          })),
                          { type: 'Earning', id: 'LIST' },
                      ]
                    : [{ type: 'Earning', id: 'LIST' }],
        }),

        getEarningById: builder.query<EarningResponse, string>({
            query: (id) => `/earnings/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Earning', id }],
        }),

        getEarningStats: builder.query<EarningStatsResponse, EarningFilters | void>({
            query: (params) => ({
                url: '/earnings/stats',
                params: params || {},
            }),
            providesTags: [{ type: 'Earning', id: 'STATS' }],
        }),

        getEarningYears: builder.query<YearsResponse, void>({
            query: () => '/earnings/years',
        }),
    }),
    overrideExisting: false,
});

export const {
    useGetEarningsQuery,
    useGetEarningByIdQuery,
    useGetEarningStatsQuery,
    useGetEarningYearsQuery,
} = earningApi;
