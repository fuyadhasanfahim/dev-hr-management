import { apiSlice } from '@/redux/api/apiSlice';
import type { DashboardStats } from '@/types/dashboard.type';

export const dashboardApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getAdminDashboard: builder.query<DashboardStats, void>({
            query: () => ({
                url: '/dashboard/admin',
                method: 'GET',
            }),
            transformResponse: (response: { data: DashboardStats }) => response.data,
            providesTags: ['Staff', 'Attendance'],
            // Refetch every 30 seconds
            keepUnusedDataFor: 30,
        }),
    }),
});

export const { useGetAdminDashboardQuery } = dashboardApi;
