import { apiSlice } from '../../api/apiSlice';

export const leadApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getLeads: builder.query({
            query: (params) => {
                const queryParams = new URLSearchParams();
                if (params?.page) queryParams.append('page', params.page.toString());
                if (params?.limit) queryParams.append('limit', params.limit.toString());
                if (params?.search) queryParams.append('search', params.search);
                if (params?.status) queryParams.append('status', params.status);
                if (params?.priority) queryParams.append('priority', params.priority);
                if (params?.source) queryParams.append('source', params.source);
                if (params?.isConverted !== undefined) queryParams.append('isConverted', params.isConverted.toString());
                
                return {
                    url: `/leads?${queryParams.toString()}`,
                    method: 'GET',
                };
            },
            providesTags: ['Lead'],
        }),
        getLeadById: builder.query({
            query: (id: string) => ({
                url: `/leads/${id}`,
                method: 'GET',
            }),
            providesTags: (_result, _error, id) => [{ type: 'Lead', id }],
        }),
        createLead: builder.mutation({
            query: (data) => ({
                url: '/leads',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Lead'],
        }),
        updateLead: builder.mutation({
            query: ({ id, data }) => ({
                url: `/leads/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Lead', { type: 'Lead', id: 'LIST' }], // Need to fix this usually, but simple ['Lead'] works
        }),
        addLeadActivity: builder.mutation({
            query: ({ id, data }) => ({
                url: `/leads/${id}/activities`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => ['Lead', { type: 'Lead', id }],
        }),
        convertLeadToClient: builder.mutation({
            query: ({ id, clientData }) => ({
                url: `/leads/${id}/convert`,
                method: 'POST',
                body: clientData,
            }),
            invalidatesTags: ['Lead', 'Client'],
        }),
    }),
});

export const {
    useGetLeadsQuery,
    useGetLeadByIdQuery,
    useCreateLeadMutation,
    useUpdateLeadMutation,
    useAddLeadActivityMutation,
    useConvertLeadToClientMutation,
} = leadApi;
