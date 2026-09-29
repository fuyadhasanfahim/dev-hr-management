import { baseApi } from './baseApi';

export interface WhatsAppConversation {
    id: string;
    name: string;
    phone: string;
    status: 'bot' | 'escalated' | 'resolved';
    aiEnabled: boolean;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
}

export interface WhatsAppMessage {
    id: string;
    direction: 'inbound' | 'outbound';
    sender: 'customer' | 'ai' | 'agent';
    body: string;
    createdAt: string;
}

export const whatsappApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getWhatsAppConversations: builder.query<WhatsAppConversation[], void>({
            query: () => '/support/whatsapp/conversations',
            transformResponse: (res: { data: WhatsAppConversation[] }) => res.data ?? [],
            providesTags: ['WhatsAppConversations'],
        }),
        getWhatsAppMessages: builder.query<WhatsAppMessage[], string>({
            query: (conversationId) => `/support/whatsapp/conversations/${conversationId}/messages`,
            transformResponse: (res: { data: WhatsAppMessage[] }) => res.data ?? [],
            providesTags: (_result, _error, conversationId) => [{ type: 'WhatsAppMessages', id: conversationId }],
        }),
        sendWhatsAppMessage: builder.mutation<WhatsAppMessage, { conversationId: string; text: string }>({
            query: ({ conversationId, text }) => ({
                url: `/support/whatsapp/conversations/${conversationId}/messages`,
                method: 'POST',
                body: { text },
            }),
            transformResponse: (res: { data: WhatsAppMessage }) => res.data,
            invalidatesTags: (_result, _error, { conversationId }) => [
                { type: 'WhatsAppMessages', id: conversationId },
                'WhatsAppConversations',
            ],
        }),
        markWhatsAppConversationRead: builder.mutation<void, string>({
            query: (conversationId) => ({
                url: `/support/whatsapp/conversations/${conversationId}/read`,
                method: 'POST',
            }),
            invalidatesTags: ['WhatsAppConversations'],
        }),
    }),
});

export const {
    useGetWhatsAppConversationsQuery,
    useGetWhatsAppMessagesQuery,
    useSendWhatsAppMessageMutation,
    useMarkWhatsAppConversationReadMutation,
} = whatsappApi;
