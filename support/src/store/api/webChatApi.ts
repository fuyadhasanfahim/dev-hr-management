import { baseApi } from './baseApi';

// The website assistant's chats, shown to staff next to WhatsApp.

export interface WebChatSummary {
    conversationId: string;
    visitorName: string | null;
    visitorEmail: string | null;
    visitorPhone: string | null;
    contactId: string | null;
    messageCount: number;
    lastAction: 'continue' | 'create_ticket' | 'connect_live_support' | 'book_consultation' | null;
    lastMessage: { role: 'user' | 'model'; content: string } | null;
    ticket: { _id: string; ticketId: string; status: string } | null;
    createdAt: string;
    updatedAt: string;
}

export interface WebChatMessage {
    role: 'user' | 'model';
    content: string;
    action?: string;
    createdAt?: string;
}

export interface WebChatDetail {
    conversationId: string;
    visitorName: string | null;
    visitorEmail: string | null;
    visitorPhone: string | null;
    messages: WebChatMessage[];
    aiMemory: string;
    contact: { _id: string; name?: string; phones: string[]; emails: string[]; whatsappPhone?: string; clientId?: string; leadId?: string } | null;
    ticket: { _id: string; ticketId: string; status: string; subject: string } | null;
    lastAction: string | null;
    createdAt: string;
    updatedAt: string;
}

export const webChatApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getWebChats: builder.query<WebChatSummary[], string | void>({
            query: (q) => `/support/web-chats${q ? `?q=${encodeURIComponent(q)}` : ''}`,
            transformResponse: (res: { data: WebChatSummary[] }) => res.data ?? [],
        }),
        getWebChat: builder.query<WebChatDetail, string>({
            query: (id) => `/support/web-chats/${id}`,
            transformResponse: (res: { data: WebChatDetail }) => res.data,
        }),
    }),
});

export const { useGetWebChatsQuery, useGetWebChatQuery } = webChatApi;
