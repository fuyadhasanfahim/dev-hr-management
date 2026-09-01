import { apiSlice } from '../../api/apiSlice';
import type {
    IOrder,
    IOrderStats,
    UpdateStatusInput,
    UpdateOrderInput,
    OrderFilters,
} from '@/types/order.type';

interface OrdersResponse {
    message: string;
    data: IOrder[];
    meta: {
        total: number;
        page: number;
        totalPages: number;
    };
}

interface OrderResponse {
    message: string;
    data: IOrder;
}

interface OrderStatsResponse {
    message: string;
    data: IOrderStats;
}

/**
 * Orders are created only by converting an accepted quotation
 * (`convertQuotationToOrder`). The `quotationSnapshot` on an order is
 * immutable — `updateOrder` only touches operational fields (priority,
 * internal notes, estimated delivery date). "Revision" is a status transition.
 */
export const orderApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getOrders: builder.query<OrdersResponse, OrderFilters | void>({
            query: (params) => ({
                url: '/orders',
                params: params || {},
            }),
            providesTags: (result) =>
                result?.data
                    ? [
                          ...result.data.map((item) => ({
                              type: 'Order' as const,
                              id: item._id,
                          })),
                          { type: 'Order', id: 'LIST' },
                      ]
                    : [{ type: 'Order', id: 'LIST' }],
        }),

        getOrderById: builder.query<OrderResponse, string>({
            query: (id) => `/orders/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Order', id }],
        }),

        getOrderStats: builder.query<OrderStatsResponse, void>({
            query: () => '/orders/stats',
            providesTags: [{ type: 'Order', id: 'STATS' }],
        }),

        getOrdersByClient: builder.query<
            { message: string; data: IOrder[] },
            { clientId: string; limit?: number }
        >({
            query: ({ clientId, limit }) => ({
                url: `/orders/client/${clientId}`,
                params: { limit },
            }),
            providesTags: (_result, _error, { clientId }) => [
                { type: 'Order', id: `CLIENT_${clientId}` },
            ],
        }),

        getOrderYears: builder.query<{ message: string; data: number[] }, void>(
            {
                query: () => '/orders/years',
                providesTags: [{ type: 'Order', id: 'YEARS' }],
            },
        ),

        updateOrder: builder.mutation<
            OrderResponse,
            { id: string; data: UpdateOrderInput }
        >({
            query: ({ id, data }) => ({
                url: `/orders/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Order', id },
                { type: 'Order', id: 'LIST' },
            ],
        }),

        updateOrderStatus: builder.mutation<
            OrderResponse,
            { id: string; data: UpdateStatusInput }
        >({
            query: ({ id, data }) => ({
                url: `/orders/${id}/status`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Order', id },
                { type: 'Order', id: 'LIST' },
                { type: 'Order', id: 'STATS' },
            ],
        }),

        updateOrderTeam: builder.mutation<
            OrderResponse,
            { id: string; data: { assignedTeam?: string[]; teamLeader?: string } }
        >({
            query: ({ id, data }) => ({
                url: `/orders/${id}/team`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Order', id },
                { type: 'Order', id: 'LIST' },
            ],
        }),

        convertQuotationToOrder: builder.mutation<
            OrderResponse,
            { quotationGroupId: string }
        >({
            query: (data) => ({
                url: '/orders/convert-quotation',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [
                { type: 'Order', id: 'LIST' },
                { type: 'Order', id: 'STATS' },
                { type: 'Quotation', id: 'LIST' },
            ],
        }),
    }),
});

export const {
    useGetOrdersQuery,
    useLazyGetOrdersQuery,
    useGetOrderByIdQuery,
    useGetOrderStatsQuery,
    useGetOrdersByClientQuery,
    useGetOrderYearsQuery,
    useUpdateOrderMutation,
    useUpdateOrderStatusMutation,
    useUpdateOrderTeamMutation,
    useConvertQuotationToOrderMutation,
} = orderApi;
