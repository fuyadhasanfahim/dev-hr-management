import { apiSlice } from "@/redux/api/apiSlice";
import { IReceipt, IReceiptPayment, PaymentSummary } from "@/types/receipt.type";

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
  paymentStatus?: string;
  search?: string;
}

export interface AddPaymentInput {
  paymentType: "full" | "partial" | "milestone";
  milestoneLabel?: string;
  amount: number;
  paymentDate?: string;
  method?: string;
  note?: string;
}

export interface AddPaymentResponse {
  receipt: IReceipt;
  payment: IReceiptPayment;
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

    // ── Payment operations ────────────────────────────────────────────────
    /** Add a payment entry to an existing receipt ledger */
    addPayment: builder.mutation<
      AddPaymentResponse,
      { receiptId: string } & AddPaymentInput
    >({
      query: ({ receiptId, ...body }) => ({
        url: `/receipts/${receiptId}/payments`,
        method: "POST",
        body,
      }),
      transformResponse: (response: { data: AddPaymentResponse }) => response.data,
      invalidatesTags: ["Receipt"],
    }),

    /** Void a single payment entry */
    voidPayment: builder.mutation<
      AddPaymentResponse,
      { receiptId: string; paymentId: string; reason?: string }
    >({
      query: ({ receiptId, paymentId, reason }) => ({
        url: `/receipts/${receiptId}/payments/${paymentId}/void`,
        method: "PATCH",
        body: { reason },
      }),
      transformResponse: (response: { data: AddPaymentResponse }) => response.data,
      invalidatesTags: ["Receipt"],
    }),

    // ── Comms ─────────────────────────────────────────────────────────────
    sendReceipt: builder.mutation<
      { data: { recipients: RecipientSendStatus[]; emailSent: boolean } },
      { id: string; emails?: string[] }
    >({
      query: ({ id, emails }) => ({
        url: `/receipts/${id}/send`,
        method: "POST",
        body: { emails },
      }),
      invalidatesTags: ["Receipt"],
    }),

    // ── Receipt lifecycle ─────────────────────────────────────────────────
    voidReceipt: builder.mutation<IReceipt, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/receipts/${id}/void`,
        method: "PATCH",
        body: { reason },
      }),
      transformResponse: (response: { data: IReceipt }) => response.data,
      invalidatesTags: ["Receipt"],
    }),

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
  useAddPaymentMutation,
  useVoidPaymentMutation,
  useSendReceiptMutation,
  useVoidReceiptMutation,
  useDeleteReceiptMutation,
} = receiptApi;
