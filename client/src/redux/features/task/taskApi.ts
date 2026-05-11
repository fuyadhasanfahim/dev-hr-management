import { apiSlice } from "../../api/apiSlice";

export const taskApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        createTask: builder.mutation({
            query: (data) => ({
                url: "/tasks",
                method: "POST",
                body: data,
            }),
            invalidatesTags: ["Order", "Task"],
        }),
        getOrderTasks: builder.query({
            query: (orderId) => ({
                url: `/tasks/order/${orderId}`,
                method: "GET",
            }),
            providesTags: (result, error, orderId) => [{ type: "Task", id: orderId }],
        }),
        getMyTasks: builder.query({
            query: () => ({
                url: "/tasks/mine",
                method: "GET",
            }),
            providesTags: ["Task"],
        }),
        submitTask: builder.mutation({
            query: ({ taskId, data }) => ({
                url: `/tasks/${taskId}/submit`,
                method: "PATCH",
                body: data,
            }),
            invalidatesTags: ["Task"],
        }),
        reviewTask: builder.mutation({
            query: ({ taskId, data }) => ({
                url: `/tasks/${taskId}/review`,
                method: "PATCH",
                body: data,
            }),
            invalidatesTags: ["Task", "Order"],
        }),
        updateTaskStatus: builder.mutation({
            query: ({ taskId, status, currentStatus }) => ({
                url: `/tasks/${taskId}/status`,
                method: "PATCH",
                body: { status, currentStatus },
            }),
            invalidatesTags: ["Task"],
        }),
        deleteTask: builder.mutation({
            query: (taskId) => ({
                url: `/tasks/${taskId}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Task"],
        }),
    }),
});

export const {
    useCreateTaskMutation,
    useGetOrderTasksQuery,
    useGetMyTasksQuery,
    useSubmitTaskMutation,
    useReviewTaskMutation,
    useUpdateTaskStatusMutation,
    useDeleteTaskMutation,
} = taskApi;
