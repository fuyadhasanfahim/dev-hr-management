import { apiSlice } from "../../api/apiSlice";

export interface Consultation {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    projectDescription: string;
    projectType?: string;
    status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
    scheduledAt?: string;
    meetingLink?: string;
    adminNotes?: string;
    source: 'ai_chat' | 'manual';
    chatTranscript?: string;
    assignedTo?: { _id: string; name: string; email: string } | string;
    meetingId?: {
        _id: string;
        meetingTitle: string;
        scheduledAt: string;
        durationMinutes: number;
        googleMeetLink?: string;
        status: string;
    } | string;
    createdAt: string;
    updatedAt: string;
}

export interface ConsultationStats {
    pending: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    total: number;
}

export interface ConsultationFilters {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
}

export interface ScheduleConsultationInput {
    status: 'scheduled';
    scheduledAt: string;
    durationMinutes?: number;
    adminNotes?: string;
    assignedTo?: string;
}

const consultationApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getConsultations: builder.query<
            {
                success: boolean;
                data: {
                    consultations: Consultation[];
                    pagination: { total: number; page: number; limit: number; totalPages: number };
                };
            },
            ConsultationFilters
        >({
            query: (params) => ({
                url: "/consultations",
                params,
            }),
            providesTags: ["Consultation"],
        }),

        getConsultationById: builder.query<{ success: boolean; data: Consultation }, string>({
            query: (id) => `/consultations/${id}`,
            providesTags: ["Consultation"],
        }),

        getConsultationStats: builder.query<{ success: boolean; data: ConsultationStats }, void>({
            query: () => "/consultations/stats",
            providesTags: ["Consultation"],
        }),

        updateConsultation: builder.mutation<
            { success: boolean; data: Consultation },
            { id: string; data: Partial<ScheduleConsultationInput & { status: string }> }
        >({
            query: ({ id, data }) => ({
                url: `/consultations/${id}`,
                method: "PATCH",
                body: data,
            }),
            invalidatesTags: ["Consultation", "Meeting"],
        }),

        deleteConsultation: builder.mutation<{ success: boolean }, string>({
            query: (id) => ({
                url: `/consultations/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Consultation"],
        }),
    }),
});

export const {
    useGetConsultationsQuery,
    useGetConsultationByIdQuery,
    useGetConsultationStatsQuery,
    useUpdateConsultationMutation,
    useDeleteConsultationMutation,
} = consultationApi;
