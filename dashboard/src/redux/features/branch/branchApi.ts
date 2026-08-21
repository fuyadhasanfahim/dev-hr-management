import { apiSlice } from '@/redux/api/apiSlice';
import type {
    IBranch,
    CreateBranchPayload,
    UpdateBranchPayload,
} from '@/types/branch.type';

export const branchApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getAllBranches: builder.query<
            { success: boolean; branches: IBranch[] },
            { isActive?: boolean; search?: string } | void
        >({
            query: (params) => ({
                url: '/branches',
                method: 'GET',
                params: params || {},
            }),
            providesTags: ['Branch'],
        }),

        getBranchById: builder.query<
            { success: boolean; branch: IBranch },
            string
        >({
            query: (id) => ({
                url: `/branches/${id}`,
                method: 'GET',
            }),
            providesTags: (_result, _error, id) => [{ type: 'Branch', id }],
        }),

        createBranch: builder.mutation<
            { success: boolean; message: string; branch: IBranch },
            CreateBranchPayload
        >({
            query: (data) => ({
                url: '/branches',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Branch'],
        }),

        updateBranch: builder.mutation<
            { success: boolean; message: string; branch: IBranch },
            { id: string; data: UpdateBranchPayload }
        >({
            query: ({ id, data }) => ({
                url: `/branches/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: ['Branch'],
        }),

        toggleBranchStatus: builder.mutation<
            { success: boolean; message: string; branch: IBranch },
            string
        >({
            query: (id) => ({
                url: `/branches/${id}/toggle-status`,
                method: 'PATCH',
            }),
            invalidatesTags: ['Branch'],
        }),

        deleteBranch: builder.mutation<
            { success: boolean; message: string },
            string
        >({
            query: (id) => ({
                url: `/branches/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Branch'],
        }),
    }),
});

export const {
    useGetAllBranchesQuery,
    useGetBranchByIdQuery,
    useCreateBranchMutation,
    useUpdateBranchMutation,
    useToggleBranchStatusMutation,
    useDeleteBranchMutation,
} = branchApi;
