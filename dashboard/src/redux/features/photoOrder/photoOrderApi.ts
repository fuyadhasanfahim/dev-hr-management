import { apiSlice } from "@/redux/api/apiSlice";
import type {
    InvoiceClientRow,
    Paged,
    PhotoInvoice,
    PhotoOrder,
    PhotoOrderFilters,
    PhotoOrderInput,
    PhotoOrderStatus,
    PhotoReturnFormat,
    PhotoService,
} from "@/types/photo-order.type";

interface Wrapped<T> {
    success: boolean;
    data: T;
}
const unwrap = <T>(r: Wrapped<T>) => r.data;

export const photoOrderApi = apiSlice.injectEndpoints({
    endpoints: (b) => ({
        // ── orders ──
        getPhotoOrders: b.query<Paged<PhotoOrder>, PhotoOrderFilters>({
            query: (params) => ({ url: "/photo-orders", params }),
            providesTags: ["PhotoOrder"],
        }),
        getPhotoOrderStats: b.query<{ total: number; totalImages: number; byStatus: Record<string, number> }, void>({
            query: () => "/photo-orders/stats",
            transformResponse: unwrap,
            providesTags: ["PhotoOrder"],
        }),
        getPhotoOrderYears: b.query<number[], void>({
            query: () => "/photo-orders/years",
            transformResponse: unwrap,
            providesTags: ["PhotoOrder"],
        }),
        createPhotoOrder: b.mutation<PhotoOrder, PhotoOrderInput>({
            query: (body) => ({ url: "/photo-orders", method: "POST", body }),
            transformResponse: unwrap,
            invalidatesTags: ["PhotoOrder", "PhotoInvoice"],
        }),
        updatePhotoOrder: b.mutation<PhotoOrder, { id: string; data: Partial<PhotoOrderInput> }>({
            query: ({ id, data }) => ({ url: `/photo-orders/${id}`, method: "PATCH", body: data }),
            transformResponse: unwrap,
            invalidatesTags: ["PhotoOrder", "PhotoInvoice"],
        }),
        deletePhotoOrder: b.mutation<void, string>({
            query: (id) => ({ url: `/photo-orders/${id}`, method: "DELETE" }),
            invalidatesTags: ["PhotoOrder", "PhotoInvoice"],
        }),
        changePhotoOrderStatus: b.mutation<PhotoOrder, { id: string; status: PhotoOrderStatus; note?: string }>({
            query: ({ id, ...body }) => ({ url: `/photo-orders/${id}/status`, method: "PATCH", body }),
            transformResponse: unwrap,
            invalidatesTags: ["PhotoOrder"],
        }),
        extendPhotoOrderDeadline: b.mutation<PhotoOrder, { id: string; deadline: string; reason?: string }>({
            query: ({ id, ...body }) => ({ url: `/photo-orders/${id}/extend-deadline`, method: "PATCH", body }),
            transformResponse: unwrap,
            invalidatesTags: ["PhotoOrder"],
        }),
        addPhotoOrderRevision: b.mutation<PhotoOrder, { id: string; instruction: string }>({
            query: ({ id, ...body }) => ({ url: `/photo-orders/${id}/revision`, method: "POST", body }),
            transformResponse: unwrap,
            invalidatesTags: ["PhotoOrder"],
        }),

        // ── metadata ──
        getPhotoServices: b.query<Paged<PhotoService>, { search?: string; isActive?: boolean; page?: number; limit?: number } | void>({
            query: (params) => ({ url: "/photo-orders/meta/services", params: params ?? undefined }),
            providesTags: ["PhotoMeta"],
        }),
        createPhotoService: b.mutation<PhotoService, { name: string; description?: string; price?: number }>({
            query: (body) => ({ url: "/photo-orders/meta/services", method: "POST", body }),
            transformResponse: unwrap,
            invalidatesTags: ["PhotoMeta"],
        }),
        updatePhotoService: b.mutation<PhotoService, { id: string; data: Partial<Pick<PhotoService, "name" | "description" | "price" | "isActive">> }>({
            query: ({ id, data }) => ({ url: `/photo-orders/meta/services/${id}`, method: "PATCH", body: data }),
            transformResponse: unwrap,
            invalidatesTags: ["PhotoMeta"],
        }),
        deletePhotoService: b.mutation<void, string>({
            query: (id) => ({ url: `/photo-orders/meta/services/${id}`, method: "DELETE" }),
            invalidatesTags: ["PhotoMeta"],
        }),
        getPhotoFormats: b.query<Paged<PhotoReturnFormat>, { search?: string; isActive?: boolean; page?: number; limit?: number } | void>({
            query: (params) => ({ url: "/photo-orders/meta/formats", params: params ?? undefined }),
            providesTags: ["PhotoMeta"],
        }),
        createPhotoFormat: b.mutation<PhotoReturnFormat, { name: string; extension: string; description?: string }>({
            query: (body) => ({ url: "/photo-orders/meta/formats", method: "POST", body }),
            transformResponse: unwrap,
            invalidatesTags: ["PhotoMeta"],
        }),
        updatePhotoFormat: b.mutation<PhotoReturnFormat, { id: string; data: Partial<Pick<PhotoReturnFormat, "name" | "extension" | "description" | "isActive">> }>({
            query: ({ id, data }) => ({ url: `/photo-orders/meta/formats/${id}`, method: "PATCH", body: data }),
            transformResponse: unwrap,
            invalidatesTags: ["PhotoMeta"],
        }),
        deletePhotoFormat: b.mutation<void, string>({
            query: (id) => ({ url: `/photo-orders/meta/formats/${id}`, method: "DELETE" }),
            invalidatesTags: ["PhotoMeta"],
        }),

        // ── invoices ──
        getInvoiceClients: b.query<InvoiceClientRow[], { month: number; year: number }>({
            query: (params) => ({ url: "/photo-orders/invoices/clients", params }),
            transformResponse: unwrap,
            providesTags: ["PhotoOrder", "PhotoInvoice"],
        }),
        getInvoiceOrders: b.query<PhotoOrder[], { clientId: string; month: number; year: number }>({
            query: (params) => ({ url: "/photo-orders/invoices/orders", params }),
            transformResponse: unwrap,
            providesTags: ["PhotoOrder", "PhotoInvoice"],
        }),
        getPhotoInvoices: b.query<PhotoInvoice[], { clientId?: string; month?: number; year?: number }>({
            query: (params) => ({ url: "/photo-orders/invoices", params }),
            transformResponse: unwrap,
            providesTags: ["PhotoInvoice"],
        }),
        getPhotoInvoice: b.query<PhotoInvoice, string>({
            query: (id) => `/photo-orders/invoices/${id}`,
            transformResponse: unwrap,
            providesTags: ["PhotoInvoice"],
        }),
        createPhotoInvoice: b.mutation<PhotoInvoice, { clientId: string; month: number; year: number; orderIds: string[] }>({
            query: (body) => ({ url: "/photo-orders/invoices", method: "POST", body }),
            transformResponse: unwrap,
            invalidatesTags: ["PhotoOrder", "PhotoInvoice"],
        }),
        deletePhotoInvoice: b.mutation<void, string>({
            query: (id) => ({ url: `/photo-orders/invoices/${id}`, method: "DELETE" }),
            invalidatesTags: ["PhotoOrder", "PhotoInvoice"],
        }),
        emailPhotoInvoice: b.mutation<{ data: { recipients: { email: string; status: string }[] } }, { id: string; emails: string[]; pdf: Blob }>({
            query: ({ id, emails, pdf }) => {
                const body = new FormData();
                body.append("emails", JSON.stringify(emails));
                body.append("pdf", pdf, "invoice.pdf");
                return { url: `/photo-orders/invoices/${id}/email`, method: "POST", body };
            },
            invalidatesTags: ["PhotoInvoice"],
        }),
    }),
});

export const {
    useGetPhotoOrdersQuery,
    useGetPhotoOrderStatsQuery,
    useGetPhotoOrderYearsQuery,
    useCreatePhotoOrderMutation,
    useUpdatePhotoOrderMutation,
    useDeletePhotoOrderMutation,
    useChangePhotoOrderStatusMutation,
    useExtendPhotoOrderDeadlineMutation,
    useAddPhotoOrderRevisionMutation,
    useGetPhotoServicesQuery,
    useCreatePhotoServiceMutation,
    useUpdatePhotoServiceMutation,
    useDeletePhotoServiceMutation,
    useGetPhotoFormatsQuery,
    useCreatePhotoFormatMutation,
    useUpdatePhotoFormatMutation,
    useDeletePhotoFormatMutation,
    useGetInvoiceClientsQuery,
    useGetInvoiceOrdersQuery,
    useGetPhotoInvoicesQuery,
    useGetPhotoInvoiceQuery,
    useCreatePhotoInvoiceMutation,
    useDeletePhotoInvoiceMutation,
    useEmailPhotoInvoiceMutation,
} = photoOrderApi;
