import { apiSlice } from '@/redux/api/apiSlice';
import type {
    IDesignation,
    CreateDesignationPayload,
    UpdateDesignationPayload,
} from '@/types/designation.type';

export const designationApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getAllDesignations: builder.query<
            { success: boolean; designations: IDesignation[] },
            { isActive?: boolean; department?: string; search?: string } | void
        >({
            query: (params) => ({
                url: '/designations',
                method: 'GET',
                params: params || {},
            }),
            providesTags: ['Designation'],
        }),

        getDesignationById: builder.query<
            { success: boolean; designation: IDesignation },
            string
        >({
            query: (id) => ({
                url: `/designations/${id}`,
                method: 'GET',
            }),
            providesTags: (_result, _error, id) => [{ type: 'Designation', id }],
        }),

        createDesignation: builder.mutation<
            { success: boolean; message: string; designation: IDesignation },
            CreateDesignationPayload
        >({
            query: (data) => ({
                url: '/designations',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Designation'],
        }),

        updateDesignation: builder.mutation<
            { success: boolean; message: string; designation: IDesignation },
            { id: string; data: UpdateDesignationPayload }
        >({
            query: ({ id, data }) => ({
                url: `/designations/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: ['Designation'],
        }),

        toggleDesignationStatus: builder.mutation<
            { success: boolean; message: string; designation: IDesignation },
            string
        >({
            query: (id) => ({
                url: `/designations/${id}/toggle-status`,
                method: 'PATCH',
            }),
            invalidatesTags: ['Designation'],
        }),

        deleteDesignation: builder.mutation<
            { success: boolean; message: string },
            string
        >({
            query: (id) => ({
                url: `/designations/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Designation'],
        }),
    }),
});

export const {
    useGetAllDesignationsQuery,
    useGetDesignationByIdQuery,
    useCreateDesignationMutation,
    useUpdateDesignationMutation,
    useToggleDesignationStatusMutation,
    useDeleteDesignationMutation,
} = designationApi;
