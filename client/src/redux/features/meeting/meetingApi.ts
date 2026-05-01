import { apiSlice } from "../../api/apiSlice";

export interface Meeting {
    _id: string;
    meetingTitle: string;
    description?: string;
    scheduledAt: string;
    durationMinutes: number;
    clientId: {
        _id: string;
        clientId: string;
        name: string;
        emails: string[];
        phone?: string;
        currency?: string;
    } | string;
    attendeeEmails: string[];
    googleEventId?: string;
    googleMeetLink?: string;
    status: 'scheduled' | 'completed' | 'cancelled';
    reminderSent: boolean;
    smsSent: boolean;
    createdBy: { _id: string; name: string; email: string } | string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateMeetingInput {
    meetingTitle: string;
    description?: string;
    scheduledAt: string;
    durationMinutes: number;
    clientId: string;
    attendeeEmails?: string[];
    notes?: string;
}

export interface MeetingFilters {
    page?: number;
    limit?: number;
    clientId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
}

const meetingApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getMeetings: builder.query<
            { success: boolean; data: Meeting[]; meta: { page: number; limit: number; total: number; totalPages: number } },
            MeetingFilters
        >({
            query: (params) => ({
                url: "/meetings",
                params,
            }),
            providesTags: ["Meeting"],
        }),

        getMeetingById: builder.query<{ success: boolean; data: Meeting }, string>({
            query: (id) => `/meetings/${id}`,
            providesTags: ["Meeting"],
        }),

        createMeeting: builder.mutation<{ success: boolean; data: Meeting }, CreateMeetingInput>({
            query: (body) => ({
                url: "/meetings",
                method: "POST",
                body,
            }),
            invalidatesTags: ["Meeting"],
        }),

        cancelMeeting: builder.mutation<{ success: boolean; data: Meeting }, string>({
            query: (id) => ({
                url: `/meetings/${id}/cancel`,
                method: "PATCH",
            }),
            invalidatesTags: ["Meeting"],
        }),

        updateMeeting: builder.mutation<{ success: boolean; data: Meeting }, { id: string; data: Partial<CreateMeetingInput> }>({
            query: ({ id, data }) => ({
                url: `/meetings/${id}`,
                method: "PUT",
                body: data,
            }),
            invalidatesTags: ["Meeting"],
        }),

        deleteMeeting: builder.mutation<{ success: boolean; data: Meeting }, string>({
            query: (id) => ({
                url: `/meetings/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Meeting"],
        }),
    }),
});

export const {
    useGetMeetingsQuery,
    useGetMeetingByIdQuery,
    useCreateMeetingMutation,
    useCancelMeetingMutation,
    useUpdateMeetingMutation,
    useDeleteMeetingMutation,
} = meetingApi;
