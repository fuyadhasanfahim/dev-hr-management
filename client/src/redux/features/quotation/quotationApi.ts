import { apiSlice } from '@/redux/api/apiSlice';
import { QuotationData } from '@/types/quotation.type';

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
    createQuotation: builder.mutation<QuotationData, Partial<QuotationData>>({
      query: (body) => ({
        url: '/quotations',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Quotation'],
    }),
    updateQuotation: builder.mutation<QuotationData, { id: string } & Partial<QuotationData>>({
      query: ({ id, ...body }) => ({
        url: `/quotations/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Quotation'],
    }),
    deleteQuotation: builder.mutation<void, string>({
      query: (id) => ({
        url: `/quotations/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Quotation'],
    }),
  }),
});

export const {
  useGetQuotationsQuery,
  useGetQuotationByIdQuery,
  useCreateQuotationMutation,
  useUpdateQuotationMutation,
  useDeleteQuotationMutation,
} = quotationApi;
