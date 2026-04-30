import { apiSlice } from '@/redux/api/apiSlice';
import { QuotationData } from '@/types/quotation.type';

export interface RecipientSendStatus {
  email: string;
  status: 'sent' | 'failed';
  error?: string;
}

export interface QuotationsResponse {
  items: QuotationData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface QuotationQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  clientId?: string;
  search?: string;
}

export const quotationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ── Read ──────────────────────────────────────────────────────────────
    getQuotations: builder.query<QuotationsResponse, QuotationQueryParams>({
      query: (params) => ({
        url: '/quotations',
        method: 'GET',
        params,
      }),
      transformResponse: (response: { data: QuotationsResponse }) => response.data,
      providesTags: ['Quotation'],
    }),

    getQuotationById: builder.query<QuotationData, string>({
      query: (id) => ({
        url: `/quotations/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: { data: QuotationData }) => response.data,
      providesTags: ['Quotation'],
    }),

    getGroupVersions: builder.query<QuotationData[], string>({
      query: (groupId) => ({
        url: `/quotations/group/${groupId}/versions`,
        method: 'GET',
      }),
      transformResponse: (response: { data: QuotationData[] }) => response.data,
      providesTags: ['Quotation'],
    }),

    // ── Create ────────────────────────────────────────────────────────────
    createQuotation: builder.mutation<QuotationData, Partial<QuotationData>>({
      query: (body) => ({
        url: '/quotations',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: QuotationData }) => response.data,
      invalidatesTags: ['Quotation'],
    }),

    createNewVersion: builder.mutation<
      { data: QuotationData },
      { groupId: string; data: Partial<QuotationData> }
    >({
      query: ({ groupId, data }) => ({
        url: `/quotations/group/${groupId}/version`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Quotation'],
    }),

    // ── Update ────────────────────────────────────────────────────────────
    updateQuotation: builder.mutation<QuotationData, { id: string } & Partial<QuotationData>>({
      query: ({ id, ...body }) => ({
        url: `/quotations/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: { data: QuotationData }) => response.data,
      invalidatesTags: ['Quotation'],
    }),

    /**
     * Send quotation to client — generates a secure token and returns a shareable link.
     * POST /quotations/:id/send
     */
    sendQuotation: builder.mutation<
      {
        data: {
          quotationId?: string;
          quotationNumber?: string;
          secureToken?: string;
          tokenExpiresAt?: string;
          clientLink: string;
          emailSent: boolean;
          emailedTo?: string[];
          emailError?: string;
          /** Per-recipient delivery result. Order matches the requested list. */
          recipients: RecipientSendStatus[];
        };
      },
      { id: string; emails?: string[] }
    >({
      query: ({ id, emails }) => ({
        url: `/quotations/${id}/send`,
        method: 'POST',
        body: emails?.length ? { emails } : undefined,
      }),
      invalidatesTags: ['Quotation'],
    }),

    // ── Delete ────────────────────────────────────────────────────────────
    deleteQuotation: builder.mutation<void, string>({
      query: (id) => ({
        url: `/quotations/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Quotation', 'Order'],
    }),
  }),
});

export const {
  useGetQuotationsQuery,
  useGetQuotationByIdQuery,
  useGetGroupVersionsQuery,
  useCreateQuotationMutation,
  useCreateNewVersionMutation,
  useUpdateQuotationMutation,
  useSendQuotationMutation,
  useDeleteQuotationMutation,
} = quotationApi;
