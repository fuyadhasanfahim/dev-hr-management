import { apiSlice } from "../../api/apiSlice";

export interface SubTaskItem {
    _id: string;
    title: string;
    completed: boolean;
    completedAt?: string;
    isSubFeature?: boolean;
    parentName?: string;
}

export interface TaskItem {
    _id: string;
    orderId: any;
    assignedTo: any;
    assignedBy: any;
    title: string;
    description?: string;
    subtasks?: SubTaskItem[];
    status: string;
    priority: string;
    startDate: string;
    dueDate: string;
    submissionNote?: string;
    submissionAttachment?: string;
    submittedAt?: string;
    reviewNote?: string;
    reviewedBy?: any;
    reviewedAt?: string;
    createdAt: string;
    updatedAt: string;
}

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
        updateTask: builder.mutation({
            query: ({ taskId, data }) => ({
                url: `/tasks/${taskId}`,
                method: "PATCH",
                body: data,
            }),
            invalidatesTags: ["Task"],
        }),
        updateTaskStatus: builder.mutation({
            query: ({ taskId, status, currentStatus }) => ({
                url: `/tasks/${taskId}/status`,
                method: "PATCH",
                body: { status, currentStatus },
            }),
            async onQueryStarted({ taskId, status }, { dispatch, queryFulfilled }) {
                const patchResultMine = dispatch(
                    taskApi.util.updateQueryData("getMyTasks", undefined, (draft: any) => {
                        if (draft?.data) {
                            const task = draft.data.find((t: any) => t._id === taskId);
                            if (task) {
                                task.status = status;
                            }
                        }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResultMine.undo();
                }
            },
            invalidatesTags: ["Task"],
        }),
        toggleSubtask: builder.mutation({
            query: ({ taskId, subtaskId, completed }) => ({
                url: `/tasks/${taskId}/subtasks/${subtaskId}/toggle`,
                method: "PATCH",
                body: { completed },
            }),
            async onQueryStarted({ taskId, subtaskId, completed }, { dispatch, queryFulfilled }) {
                const patchResultMine = dispatch(
                    taskApi.util.updateQueryData("getMyTasks", undefined, (draft: any) => {
                        if (draft?.data) {
                            const task = draft.data.find((t: any) => t._id === taskId);
                            if (task?.subtasks) {
                                const st = task.subtasks.find((s: any) => s._id === subtaskId);
                                if (st) {
                                    st.completed = completed !== undefined ? completed : !st.completed;
                                    st.completedAt = st.completed ? new Date().toISOString() : undefined;
                                }
                            }
                        }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResultMine.undo();
                }
            },
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
    useUpdateTaskMutation,
    useUpdateTaskStatusMutation,
    useToggleSubtaskMutation,
    useDeleteTaskMutation,
} = taskApi;
