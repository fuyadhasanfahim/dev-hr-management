import { baseApi } from './baseApi';

export const notificationApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getUnreadNotificationCount: builder.query<number, void>({
            query: () => '/notifications/unread-count',
            transformResponse: (res: { data: { count: number } }) => res.data?.count ?? 0,
        }),
    }),
});

export const { useGetUnreadNotificationCountQuery } = notificationApi;
