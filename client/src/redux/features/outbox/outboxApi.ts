import { apiSlice } from '@/redux/api/apiSlice';

type OutboxStatus =
    | 'pending'
    | 'processing'
    | 'processed'
    | 'failed'
    | 'dead_letter'
    | 'cancelled';

export type OutboxEvent = {
    _id: string;
    dedupeKey: string;
    eventName: string;
    status: OutboxStatus;
    attempts: number;
    maxAttempts: number;
    nextAttemptAt?: string;
    processedAt?: string;
    lastError?: string;
    createdAt: string;
    payload: Record<string, unknown>;
};

export type OutboxListResponse = {
    items: OutboxEvent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export const outboxApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        listOutbox: builder.query<
            OutboxListResponse,
            { status?: OutboxStatus; eventName?: string; page?: number; limit?: number }
        >({
            query: (params) => ({
                url: '/admin/outbox',
                method: 'GET',
                params,
            }),
            transformResponse: (response: { data: OutboxListResponse }) => response.data,
            providesTags: ['Outbox'],
            keepUnusedDataFor: 5,
        }),
        replayOutbox: builder.mutation<void, { id: string }>({
            query: ({ id }) => ({
                url: `/admin/outbox/${id}/replay`,
                method: 'POST',
            }),
            invalidatesTags: ['Outbox'],
        }),
        replayOutboxMany: builder.mutation<void, { ids: string[] }>({
            query: (body) => ({
                url: '/admin/outbox/replay',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Outbox'],
        }),
    }),
});

export const {
    useListOutboxQuery,
    useReplayOutboxMutation,
    useReplayOutboxManyMutation,
} = outboxApi;

