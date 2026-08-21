import { apiSlice } from '@/redux/api/apiSlice';
import type {
    IDepartment,
    CreateDepartmentPayload,
    UpdateDepartmentPayload,
} from '@/types/department.type';

export const departmentApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getAllDepartments: builder.query<
            { success: boolean; departments: IDepartment[] },
            { isActive?: boolean; search?: string } | void
        >({
            query: (params) => ({
                url: '/departments',
                method: 'GET',
                params: params || {},
            }),
            providesTags: ['Department'],
        }),

        getDepartmentById: builder.query<
            { success: boolean; department: IDepartment },
            string
        >({
            query: (id) => ({
                url: `/departments/${id}`,
                method: 'GET',
            }),
            providesTags: (_result, _error, id) => [{ type: 'Department', id }],
        }),

        createDepartment: builder.mutation<
            { success: boolean; message: string; department: IDepartment },
            CreateDepartmentPayload
        >({
            query: (data) => ({
                url: '/departments',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Department'],
        }),

        updateDepartment: builder.mutation<
            { success: boolean; message: string; department: IDepartment },
            { id: string; data: UpdateDepartmentPayload }
        >({
            query: ({ id, data }) => ({
                url: `/departments/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: ['Department'],
        }),

        toggleDepartmentStatus: builder.mutation<
            { success: boolean; message: string; department: IDepartment },
            string
        >({
            query: (id) => ({
                url: `/departments/${id}/toggle-status`,
                method: 'PATCH',
            }),
            invalidatesTags: ['Department'],
        }),

        deleteDepartment: builder.mutation<
            { success: boolean; message: string },
            string
        >({
            query: (id) => ({
                url: `/departments/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Department'],
        }),
    }),
});

export const {
    useGetAllDepartmentsQuery,
    useGetDepartmentByIdQuery,
    useCreateDepartmentMutation,
    useUpdateDepartmentMutation,
    useToggleDepartmentStatusMutation,
    useDeleteDepartmentMutation,
} = departmentApi;
