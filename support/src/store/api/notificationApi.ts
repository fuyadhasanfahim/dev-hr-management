import { baseApi } from './baseApi';

export interface Notification {
    _id: string;
    userId: string;
    title: string;
    message: string;
    type: string;
    actionUrl?: string;
    isRead: boolean;
    createdAt: string;
}

export const notificationApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getUnreadNotificationCount: builder.query<number, void>({
            query: () => '/notifications/unread-count',
            transformResponse: (res: { data: { count: number } }) => res.data?.count ?? 0,
            providesTags: ['Notifications'],
        }),
        getNotifications: builder.query<Notification[], { limit?: number; skip?: number }>({
            query: ({ limit = 20, skip = 0 }) => `/notifications?limit=${limit}&skip=${skip}`,
            transformResponse: (res: { data: Notification[] }) => res.data ?? [],
            providesTags: ['Notifications'],
        }),
        markNotificationAsRead: builder.mutation<void, string>({
            query: (id) => ({
                url: `/notifications/${id}/read`,
                method: 'PATCH',
            }),
            invalidatesTags: ['Notifications'],
        }),
        markAllNotificationsAsRead: builder.mutation<void, void>({
            query: () => ({
                url: '/notifications/read-all',
                method: 'POST',
            }),
            invalidatesTags: ['Notifications'],
        }),
    }),
});

export const {
    useGetUnreadNotificationCountQuery,
    useGetNotificationsQuery,
    useMarkNotificationAsReadMutation,
    useMarkAllNotificationsAsReadMutation,
} = notificationApi;
