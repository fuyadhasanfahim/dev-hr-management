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

// One website chat as the Messages inbox lists it: visitor, last message, unread count and its ticket.
export interface WebInboxChat {
    sessionId: string;
    status: 'queued' | 'active' | 'ended' | 'converted_to_ticket';
    createdAt: string;
    assignedAgent: { _id: string; name: string; email?: string } | null;
    visitor: { name: string; email: string | null; phone: string | null; isWhatsapp: boolean | null; isClient: boolean };
    lastMessage: { content: string; attachments: string[]; createdAt: string; senderModel: 'Client' | 'Staff' | 'Guest' | 'System' };
    lastMessageAt: string;
    unreadCount: number;
    ticket: { id: string; ticketId: string; status: string } | null;
    // Set once the team moved this chat to WhatsApp (the website chat is read-only after that).
    whatsappConversationId: string | null;
}

export interface ChatVisitorTicket {
    id: string;
    ticketId: string;
    subject: string;
    status: string;
    category?: string;
    source?: string;
    createdAt: string;
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
        getWebInbox: builder.query<WebInboxChat[], void>({
            query: () => '/support/chat/sessions/inbox',
            transformResponse: (res: { data: WebInboxChat[] }) => res.data ?? [],
            providesTags: ['WebInbox'],
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
            invalidatesTags: ['QueuedSessions', 'ActiveSessions', 'WebInbox'],
        }),
        closeSession: builder.mutation<void, string>({
            query: (sessionId) => ({
                url: `/support/chat/sessions/${sessionId}/close`,
                method: 'POST',
            }),
            invalidatesTags: ['ActiveSessions', 'QueuedSessions', 'WebInbox'],
        }),
        // Opens a ticket from a website chat: the visitor is emailed their private link and gets a ticket card in the chat.
        convertToTicket: builder.mutation<
            { ticketId: string },
            { sessionId: string; reason?: string; subject?: string; category?: string }
        >({
            query: ({ sessionId, ...body }) => ({
                url: `/support/chat/sessions/${sessionId}/convert`,
                method: 'POST',
                body: Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === 'string' && v.trim())),
            }),
            transformResponse: (res: { data: { ticketId: string } }) => res.data,
            invalidatesTags: ['ActiveSessions', 'WebInbox', 'Tickets'],
        }),
        // The person behind a website chat: their tickets, newest first.
        getChatVisitorTickets: builder.query<ChatVisitorTicket[], string>({
            query: (sessionId) => `/support/chat/sessions/${sessionId}/tickets`,
            transformResponse: (res: { data: ChatVisitorTicket[] }) => res.data ?? [],
            providesTags: ['Tickets'],
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
        createMeeting: builder.mutation<unknown, {
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
            transformResponse: (res: { data: unknown }) => res.data,
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
    useGetWebInboxQuery,
    useGetChatVisitorTicketsQuery,
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
