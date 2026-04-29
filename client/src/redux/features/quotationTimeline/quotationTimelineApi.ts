import { apiSlice } from '@/redux/api/apiSlice';

export type TimelineItem = {
    kind: 'quotation' | 'payment_event' | 'outbox' | 'order';
    at: string;
    data: Record<string, unknown>;
};

export type QuotationTimelineResponse = {
    quotationGroupId: string;
    items: TimelineItem[];
};

export const quotationTimelineApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getQuotationTimeline: builder.query<QuotationTimelineResponse, { quotationGroupId: string }>({
            query: ({ quotationGroupId }) => ({
                url: `/admin/quotation-timeline/${quotationGroupId}`,
                method: 'GET',
            }),
            transformResponse: (response: { data: QuotationTimelineResponse }) => response.data,
            providesTags: (_res, _err, arg) => [{ type: 'QuotationTimeline' as const, id: arg.quotationGroupId }],
        }),
        regenerateQuotationLink: builder.mutation<{ outboxEventId?: string }, { quotationGroupId: string }>({
            query: ({ quotationGroupId }) => ({
                url: `/admin/quotation-timeline/${quotationGroupId}/regenerate-link`,
                method: 'POST',
            }),
            transformResponse: (response: { data: { outboxEventId?: string } }) => response.data,
            invalidatesTags: (_res, _err, arg) => [{ type: 'QuotationTimeline' as const, id: arg.quotationGroupId }],
        }),
        replayQuotationGroupEvents: builder.mutation<
            { outboxEventId?: string },
            { quotationGroupId: string; mode?: 'failed_for_group'; ids?: string[] }
        >({
            query: ({ quotationGroupId, ...body }) => ({
                url: `/admin/quotation-timeline/${quotationGroupId}/replay`,
                method: 'POST',
                body,
            }),
            transformResponse: (response: { data: { outboxEventId?: string } }) => response.data,
            invalidatesTags: (_res, _err, arg) => [{ type: 'QuotationTimeline' as const, id: arg.quotationGroupId }],
        }),
    }),
});

export const {
    useGetQuotationTimelineQuery,
    useRegenerateQuotationLinkMutation,
    useReplayQuotationGroupEventsMutation,
} = quotationTimelineApi;

