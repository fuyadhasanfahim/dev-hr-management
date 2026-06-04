import { baseApi } from './baseApi';

export interface ChatUser {
    _id: string;
    name: string;
    email: string;
}

export interface LastMessage {
    content: string;
    attachments: string[];
    createdAt: string;
}

export interface ChatSession {
    _id: string;
    sessionId: string;
    status: 'queued' | 'active' | 'ended' | 'converted_to_ticket';
    assignedAgent?: ChatUser;
    clientId?: ChatUser;
    guestId?: ChatUser;
    lastMessage?: LastMessage | null;
    createdAt: string;
    updatedAt: string;
}

export interface ChatMessage {
    _id: string;
    sessionId: string;
    sender: string;
    senderModel: 'Client' | 'Staff' | 'Guest' | 'System';
    senderName: string;
    content: string;
    attachments: string[];
    readBy: string[];
    createdAt: string;
}

export interface AgentInfo {
    _id: string;
    name: string;
    userId: { _id: string; name: string; email: string; image?: string };
    department?: string;
    designation?: string;
}

export interface ActivityItem {
    type: 'chat_new' | 'chat_resolved' | 'ticket_new';
    label: string;
    at: string;
}

export interface DashboardStats {
    openTickets: number;
    liveChats: number;
    resolvedToday: number;
    avgResponseTimeMinutes: number | null;
    recentActivity?: ActivityItem[];
}

export interface Meeting {
    _id: string;
    meetingTitle: string;
    scheduledAt: string;
    durationMinutes: number;
    status: 'scheduled' | 'completed' | 'cancelled';
    googleMeetLink?: string;
    description?: string;
    clientId?: string;
    createdAt: string;
}

export const chatApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getQueuedSessions: builder.query<ChatSession[], void>({
            query: () => '/support/chat/sessions/queued',
            transformResponse: (res: { data: ChatSession[] }) => res.data ?? [],
            providesTags: ['QueuedSessions'],
        }),
        getActiveSessions: builder.query<ChatSession[], void>({
            query: () => '/support/chat/sessions/active',
            transformResponse: (res: { data: ChatSession[] }) => res.data ?? [],
            providesTags: ['ActiveSessions'],
        }),
        getResolvedSessions: builder.query<ChatSession[], void>({
            query: () => '/support/chat/sessions/resolved',
            transformResponse: (res: { data: ChatSession[] }) => res.data ?? [],
            providesTags: ['ResolvedSessions'],
        }),
        getDashboardStats: builder.query<DashboardStats, void>({
            query: () => '/support/dashboard/stats',
            transformResponse: (res: { data: DashboardStats }) => res.data,
            providesTags: ['DashboardStats'],
        }),
        getSessionMessages: builder.query<ChatMessage[], string>({
            query: (sessionId) => `/support/chat/sessions/${sessionId}/messages`,
            transformResponse: (res: { data: ChatMessage[] }) => res.data ?? [],
            providesTags: (_result, _error, sessionId) => [
                { type: 'SessionMessages', id: sessionId },
            ],
        }),
        claimSession: builder.mutation<ChatSession, string>({
            query: (sessionId) => ({
                url: `/support/chat/sessions/${sessionId}/claim`,
                method: 'POST',
            }),
            transformResponse: (res: { data: ChatSession }) => res.data,
            invalidatesTags: ['QueuedSessions', 'ActiveSessions'],
        }),
        closeSession: builder.mutation<void, string>({
            query: (sessionId) => ({
                url: `/support/chat/sessions/${sessionId}/close`,
                method: 'POST',
            }),
            invalidatesTags: ['ActiveSessions', 'QueuedSessions'],
        }),
        convertToTicket: builder.mutation<
            { ticketId: string },
            { sessionId: string; reason?: string }
        >({
            query: ({ sessionId, reason }) => ({
                url: `/support/chat/sessions/${sessionId}/convert`,
                method: 'POST',
                body: reason ? { reason } : {},
            }),
            transformResponse: (res: { data: { ticketId: string } }) => res.data,
            invalidatesTags: ['ActiveSessions'],
        }),
        getUnreadCounts: builder.query<Record<string, number>, void>({
            query: () => '/support/chat/sessions/unread-counts',
            transformResponse: (res: { data: Record<string, number> }) => res.data ?? {},
            providesTags: ['UnreadCounts'],
        }),
        requestPresignedUrl: builder.mutation<
            { uploadUrl: string; fileUrl: string; fileKey: string },
            { fileName: string; fileType: string; fileSize: number; folder: string; referenceId: string }
        >({
            query: (body) => ({
                url: '/support/attachments/presigned-url',
                method: 'POST',
                body,
            }),
            transformResponse: (res: { data: { uploadUrl: string; fileUrl: string; fileKey: string } }) => res.data,
        }),
        getPresignedViewUrl: builder.query<{ viewUrl: string }, string>({
            query: (fileKey) => `/support/attachments/view-url?fileKey=${encodeURIComponent(fileKey)}`,
            transformResponse: (res: { data: { viewUrl: string } }) => res.data,
        }),
        getAvailableAgents: builder.query<AgentInfo[], void>({
            query: () => '/support/chat/agents',
            transformResponse: (res: { data: AgentInfo[] }) => res.data ?? [],
        }),
        reassignSession: builder.mutation<ChatSession, { sessionId: string; agentId: string }>({
            query: ({ sessionId, agentId }) => ({
                url: `/support/chat/sessions/${sessionId}/reassign`,
                method: 'POST',
                body: { agentId },
            }),
            transformResponse: (res: { data: ChatSession }) => res.data,
            invalidatesTags: ['ActiveSessions'],
        }),
        createMeeting: builder.mutation<any, {
            meetingTitle: string;
            scheduledAt: string;
            durationMinutes: number;
            createdBy: string;
            clientId?: string;
            attendeeEmails?: string[];
            description?: string;
        }>({
            query: (body) => ({
                url: '/support/meetings',
                method: 'POST',
                body,
            }),
            transformResponse: (res: { data: any }) => res.data,
            invalidatesTags: ['ClientMeetings'],
        }),
        getClientMeetings: builder.query<Meeting[], string>({
            query: (clientId) => `/meetings?clientId=${clientId}&status=scheduled`,
            transformResponse: (res: { data: Meeting[] }) => res.data ?? [],
            providesTags: ['ClientMeetings'],
        }),
        lookupClientByEmail: builder.query<{ name: string; clientId: string | null } | null, string>({
            query: (email) => `/support/chat/client-lookup?email=${encodeURIComponent(email)}`,
            transformResponse: (res: { data: { name: string; clientId: string | null } | null }) => res.data,
        }),
    }),
});

export const {
    useGetQueuedSessionsQuery,
    useGetActiveSessionsQuery,
    useGetResolvedSessionsQuery,
    useGetDashboardStatsQuery,
    useGetSessionMessagesQuery,
    useClaimSessionMutation,
    useCloseSessionMutation,
    useConvertToTicketMutation,
    useGetUnreadCountsQuery,
    useRequestPresignedUrlMutation,
    useLazyGetPresignedViewUrlQuery,
    useGetAvailableAgentsQuery,
    useReassignSessionMutation,
    useCreateMeetingMutation,
    useGetClientMeetingsQuery,
    useLookupClientByEmailQuery,
    useLazyLookupClientByEmailQuery,
} = chatApi;
