import { baseApi } from './baseApi';

export type WhatsAppMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface WhatsAppConversation {
    id: string;
    name: string;
    phone: string;
    status: 'bot' | 'escalated' | 'resolved';
    aiEnabled: boolean;
    lastMessage: string;
    lastMessageDirection: 'inbound' | 'outbound' | null;
    lastMessageStatus: WhatsAppMessageStatus | null;
    lastMessageAt: string;
    unreadCount: number;
}

export interface WhatsAppMessage {
    id: string;
    direction: 'inbound' | 'outbound';
    sender: 'customer' | 'ai' | 'agent';
    body: string;
    status: WhatsAppMessageStatus | null;
    error: string | null;
    clientId: string | null;
    createdAt: string;
}

// One key per bubble for its whole life: optimistic → saved → refetched.
export const messageKey = (m: WhatsAppMessage) => m.clientId ?? m.id;

// Client-side id for an optimistic bubble that the server hasn't acknowledged yet.
export const isLocalMessageId = (id: string) => id.startsWith('local-');

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
        // Optimistic: the bubble is in the thread before the request leaves; the
        // server only queues the send, and ticks arrive later over the socket.
        sendWhatsAppMessage: builder.mutation<WhatsAppMessage, { conversationId: string; text: string; localId: string }>({
            query: ({ conversationId, text, localId }) => ({
                url: `/support/whatsapp/conversations/${conversationId}/messages`,
                method: 'POST',
                body: { text, clientId: localId },
            }),
            transformResponse: (res: { data: WhatsAppMessage }) => res.data,
            invalidatesTags: ['WhatsAppConversations'],
            async onQueryStarted({ conversationId, text, localId }, { dispatch, queryFulfilled }) {
                const patchThread = (recipe: (draft: WhatsAppMessage[]) => void) =>
                    dispatch(whatsappApi.util.updateQueryData('getWhatsAppMessages', conversationId, recipe));

                patchThread((draft) => {
                    draft.push({
                        id: localId,
                        direction: 'outbound',
                        sender: 'agent',
                        body: text,
                        status: 'pending',
                        error: null,
                        clientId: localId,
                        createdAt: new Date().toISOString(),
                    });
                });

                try {
                    const { data } = await queryFulfilled;
                    patchThread((draft) => {
                        const localIndex = draft.findIndex((m) => m.id === localId);
                        const alreadyThere = draft.some((m) => m.id === data.id);
                        if (localIndex >= 0) {
                            if (alreadyThere) draft.splice(localIndex, 1);
                            else draft[localIndex] = data;
                        } else if (!alreadyThere) {
                            // A refetch replaced the thread mid-flight and dropped the bubble.
                            draft.push(data);
                        }
                    });
                } catch {
                    patchThread((draft) => {
                        const local = draft.find((m) => m.id === localId);
                        if (local) {
                            local.status = 'failed';
                            local.error = 'Could not reach the server';
                        }
                    });
                }
            },
        }),
        retryWhatsAppMessage: builder.mutation<WhatsAppMessage, { conversationId: string; messageId: string }>({
            query: ({ conversationId, messageId }) => ({
                url: `/support/whatsapp/conversations/${conversationId}/messages/${messageId}/retry`,
                method: 'POST',
            }),
            transformResponse: (res: { data: WhatsAppMessage }) => res.data,
            async onQueryStarted({ conversationId, messageId }, { dispatch, queryFulfilled }) {
                const patch = dispatch(
                    whatsappApi.util.updateQueryData('getWhatsAppMessages', conversationId, (draft) => {
                        const m = draft.find((x) => x.id === messageId);
                        if (m) {
                            m.status = 'pending';
                            m.error = null;
                        }
                    }),
                );
                queryFulfilled.catch(patch.undo);
            },
        }),
        setWhatsAppAi: builder.mutation<void, { conversationId: string; aiEnabled: boolean }>({
            query: ({ conversationId, aiEnabled }) => ({
                url: `/support/whatsapp/conversations/${conversationId}/ai`,
                method: 'PATCH',
                body: { aiEnabled },
            }),
            async onQueryStarted({ conversationId, aiEnabled }, { dispatch, queryFulfilled }) {
                const patch = dispatch(
                    whatsappApi.util.updateQueryData('getWhatsAppConversations', undefined, (draft) => {
                        const c = draft.find((x) => x.id === conversationId);
                        if (c) c.aiEnabled = aiEnabled;
                    }),
                );
                queryFulfilled.catch(patch.undo);
            },
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
    useRetryWhatsAppMessageMutation,
    useSetWhatsAppAiMutation,
    useMarkWhatsAppConversationReadMutation,
} = whatsappApi;
