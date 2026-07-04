import { apiSlice } from "@/redux/api/apiSlice";
import { IReceipt, PaymentSummary } from "@/types/receipt.type";

export interface RecipientSendStatus {
  email: string;
  status: "sent" | "failed";
  error?: string;
}

export interface ReceiptsResponse {
  items: IReceipt[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReceiptQueryParams {
  page?: number;
  limit?: number;
  clientId?: string;
  quotationGroupId?: string;
  status?: string;
  search?: string;
}

export interface CreateReceiptInput {
  quotationId: string;
  paymentType: "full" | "partial" | "milestone";
  milestoneLabel?: string;
  amount: number;
  paymentDate?: string;
  method?: string;
  note?: string;
}

export const receiptApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ── Read ──────────────────────────────────────────────────────────────
    getReceipts: builder.query<ReceiptsResponse, ReceiptQueryParams>({
      query: (params) => ({
        url: "/receipts",
        method: "GET",
        params,
      }),
      transformResponse: (response: { data: ReceiptsResponse }) => response.data,
      providesTags: ["Receipt"],
    }),

    getReceiptById: builder.query<IReceipt, string>({
      query: (id) => ({
        url: `/receipts/${id}`,
        method: "GET",
      }),
      transformResponse: (response: { data: IReceipt }) => response.data,
      providesTags: ["Receipt"],
    }),

    getPaymentSummary: builder.query<PaymentSummary, string>({
      query: (quotationGroupId) => ({
        url: `/receipts/summary/${quotationGroupId}`,
        method: "GET",
      }),
      transformResponse: (response: { data: PaymentSummary }) => response.data,
      providesTags: ["Receipt"],
    }),

    // ── Create ────────────────────────────────────────────────────────────
    createReceipt: builder.mutation<IReceipt, CreateReceiptInput>({
      query: (body) => ({
        url: "/receipts",
        method: "POST",
        body,
      }),
      transformResponse: (response: { data: IReceipt }) => response.data,
      invalidatesTags: ["Receipt"],
    }),

    /**
     * Send receipt to client — attaches the branded PDF and emails it.
     * POST /receipts/:id/send
     */
    sendReceipt: builder.mutation<
      {
        data: {
          recipients: RecipientSendStatus[];
          emailSent: boolean;
        };
      },
      { id: string; emails?: string[] }
    >({
      query: ({ id, emails }) => ({
        url: `/receipts/${id}/send`,
        method: "POST",
        body: { emails },
      }),
      invalidatesTags: ["Receipt"],
    }),

    // ── Update ────────────────────────────────────────────────────────────
    voidReceipt: builder.mutation<IReceipt, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/receipts/${id}/void`,
        method: "PATCH",
        body: { reason },
      }),
      transformResponse: (response: { data: IReceipt }) => response.data,
      invalidatesTags: ["Receipt"],
    }),

    // ── Delete ────────────────────────────────────────────────────────────
    deleteReceipt: builder.mutation<void, string>({
      query: (id) => ({
        url: `/receipts/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Receipt"],
    }),
  }),
});

export const {
  useGetReceiptsQuery,
  useGetReceiptByIdQuery,
  useGetPaymentSummaryQuery,
  useCreateReceiptMutation,
  useSendReceiptMutation,
  useVoidReceiptMutation,
  useDeleteReceiptMutation,
} = receiptApi;
