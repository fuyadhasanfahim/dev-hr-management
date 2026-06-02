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
        }),
    }),
});

export const {
    useGetQueuedSessionsQuery,
    useGetActiveSessionsQuery,
    useGetSessionMessagesQuery,
    useClaimSessionMutation,
    useCloseSessionMutation,
    useConvertToTicketMutation,
    useGetUnreadCountsQuery,
    useRequestPresignedUrlMutation,
    useGetAvailableAgentsQuery,
    useReassignSessionMutation,
    useCreateMeetingMutation,
} = chatApi;
