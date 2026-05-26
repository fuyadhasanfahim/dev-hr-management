import { apiSlice } from '../../api/apiSlice';

export const leadSettingApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getLeadSettings: builder.query({
            query: (type?: string) => ({
                url: `/lead-settings${type ? `?type=${type}` : ''}`,
                method: 'GET',
            }),
            providesTags: ['LeadSetting'],
        }),
        createLeadSetting: builder.mutation({
            query: (data) => ({
                url: '/lead-settings',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['LeadSetting'],
        }),
        updateLeadSetting: builder.mutation({
            query: ({ id, data }) => ({
                url: `/lead-settings/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['LeadSetting'],
        }),
        deleteLeadSetting: builder.mutation({
            query: (id) => ({
                url: `/lead-settings/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['LeadSetting'],
        }),
    }),
});

export const {
    useGetLeadSettingsQuery,
    useCreateLeadSettingMutation,
    useUpdateLeadSettingMutation,
    useDeleteLeadSettingMutation,
} = leadSettingApi;
