import { toast } from 'sonner';
import { baseApi } from './baseApi';

export type WhatsAppMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface WhatsAppAssignee {
    id: string;
    name: string;
}

export interface WhatsAppNote {
    id: string;
    body: string;
    author: WhatsAppAssignee;
    createdAt: string;
}

export interface WhatsAppCustomerDetails {
    name: string | null;
    phone: string;
    status: 'bot' | 'escalated' | 'resolved';
    aiEnabled: boolean;
    assignedTo: WhatsAppAssignee | null;
    assignedAt: string | null;
    firstContactAt: string;
    messageCount: number;
    conversationCount: number;
    linkedTicketId: string | null;
    client: {
        id: string;
        clientId: string | null;
        name: string;
        email: string | null;
        status: string;
        currency: string | null;
        address: string | null;
        since: string | null;
    } | null;
    lead: { id: string; name: string; email: string | null; status: string; source: string | null } | null;
}

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
    assignedTo: WhatsAppAssignee | null;
}

export type WhatsAppMessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'call';

export interface WhatsAppMedia {
    id: string;
    mimeType: string;
    filename?: string;
    voice?: boolean;
}

export interface WhatsAppMessage {
    id: string;
    direction: 'inbound' | 'outbound';
    sender: 'customer' | 'ai' | 'agent';
    type: WhatsAppMessageType;
    body: string;
    media: WhatsAppMedia | null;
    localUrl?: string; // Blob URL of an optimistic upload, until the server copy is fetched.
    status: WhatsAppMessageStatus | null;
    error: string | null;
    clientId: string | null;
    fromApp?: boolean; // Sent from the WhatsApp Business app on the phone.
    edited?: boolean;
    deleted?: boolean; // Deleted for everyone — shown as a tombstone.
    createdAt: string;
}

const API_URL = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5000'}/api`;

// Media is streamed through our API (Meta's own URLs need the business token).
export const mediaUrl = (m: WhatsAppMessage) =>
    m.localUrl ?? (m.media ? `${API_URL}/support/whatsapp/media/${m.media.id}` : '');

// Same-type guess the server makes, so the optimistic bubble renders right.
function guessType(mimeType: string, voice: boolean): WhatsAppMessageType {
    if (voice || mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'image/jpeg' || mimeType === 'image/png') return 'image';
    if (mimeType === 'video/mp4' || mimeType === 'video/3gpp') return 'video';
    return 'document';
}

// 409 = another agent owns the chat: drop the bubble (it was never sent) and say who.
function rejectedByAssignment(err: unknown): string | null {
    const e = (err as { error?: { status?: number; data?: { message?: string; code?: string } } })?.error;
    return e?.status === 409 && e.data?.code === 'ASSIGNED' ? (e.data.message ?? 'Another agent is handling this chat') : null;
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
                        type: 'text',
                        body: text,
                        media: null,
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
                } catch (err) {
                    const assigned = rejectedByAssignment(err);
                    if (assigned) {
                        patchThread((draft) => draft.filter((m) => m.id !== localId));
                        toast.error('Message not sent', { description: assigned });
                        dispatch(whatsappApi.util.invalidateTags(['WhatsAppConversations']));
                        return;
                    }
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
        // Same optimistic flow as text; the bubble plays the local blob until the
        // server copy (streamed from Meta) replaces it.
        sendWhatsAppMedia: builder.mutation<
            WhatsAppMessage,
            { conversationId: string; file: Blob; filename: string; caption?: string; voice?: boolean; localId: string }
        >({
            query: ({ conversationId, file, filename, caption, voice, localId }) => {
                const form = new FormData();
                form.append('file', file, filename);
                if (caption) form.append('caption', caption);
                if (voice) form.append('voice', 'true');
                form.append('clientId', localId);
                return { url: `/support/whatsapp/conversations/${conversationId}/media`, method: 'POST', body: form };
            },
            transformResponse: (res: { data: WhatsAppMessage }) => res.data,
            invalidatesTags: ['WhatsAppConversations'],
            async onQueryStarted({ conversationId, file, filename, caption, voice, localId }, { dispatch, queryFulfilled }) {
                const patchThread = (recipe: (draft: WhatsAppMessage[]) => void) =>
                    dispatch(whatsappApi.util.updateQueryData('getWhatsAppMessages', conversationId, recipe));
                const localUrl = URL.createObjectURL(file);
                const type = guessType(file.type, !!voice);

                patchThread((draft) => {
                    draft.push({
                        id: localId,
                        direction: 'outbound',
                        sender: 'agent',
                        type,
                        body: type === 'audio' ? '' : (caption ?? ''),
                        media: { id: localId, mimeType: file.type, filename, voice },
                        localUrl,
                        status: 'pending',
                        error: null,
                        clientId: localId,
                        createdAt: new Date().toISOString(),
                    });
                });

                try {
                    const { data } = await queryFulfilled;
                    // Keep playing the local blob — no re-download of a file we already have.
                    patchThread((draft) => {
                        const i = draft.findIndex((m) => m.id === localId);
                        if (i >= 0) draft[i] = { ...data, localUrl };
                        else if (!draft.some((m) => m.id === data.id)) draft.push({ ...data, localUrl });
                    });
                } catch (err) {
                    const assigned = rejectedByAssignment(err);
                    if (assigned) {
                        patchThread((draft) => draft.filter((m) => m.id !== localId));
                        toast.error('File not sent', { description: assigned });
                        dispatch(whatsappApi.util.invalidateTags(['WhatsAppConversations']));
                        return;
                    }
                    const message = (err as { error?: { data?: { message?: string } } })?.error?.data?.message;
                    patchThread((draft) => {
                        const local = draft.find((m) => m.id === localId);
                        if (local) {
                            local.status = 'failed';
                            local.error = message ?? 'Upload failed';
                        }
                    });
                }
            },
        }),
        startWhatsAppCall: builder.mutation<{ callId: string }, { conversationId: string; sdp: string }>({
            query: ({ conversationId, sdp }) => ({
                url: `/support/whatsapp/conversations/${conversationId}/call`,
                method: 'POST',
                body: { sdp },
            }),
            transformResponse: (res: { data: { callId: string } }) => res.data,
        }),
        requestWhatsAppCallPermission: builder.mutation<void, string>({
            query: (conversationId) => ({
                url: `/support/whatsapp/conversations/${conversationId}/call-permission`,
                method: 'POST',
            }),
        }),
        acceptWhatsAppCall: builder.mutation<void, { callId: string; sdp: string }>({
            query: ({ callId, sdp }) => ({ url: `/support/whatsapp/calls/${callId}/accept`, method: 'POST', body: { sdp } }),
        }),
        rejectWhatsAppCall: builder.mutation<void, string>({
            query: (callId) => ({ url: `/support/whatsapp/calls/${callId}/reject`, method: 'POST' }),
        }),
        endWhatsAppCall: builder.mutation<void, string>({
            query: (callId) => ({ url: `/support/whatsapp/calls/${callId}/end`, method: 'POST' }),
        }),
        // ponytail: WhatsApp can't edit/revoke a sent message through the Cloud API, so
        // both change the CRM copy only (the dialogs say so).
        editWhatsAppMessage: builder.mutation<WhatsAppMessage, { conversationId: string; messageId: string; text: string }>({
            query: ({ conversationId, messageId, text }) => ({
                url: `/support/whatsapp/conversations/${conversationId}/messages/${messageId}`,
                method: 'PATCH',
                body: { text },
            }),
            invalidatesTags: (_r, _e, { conversationId }) => ['WhatsAppConversations', { type: 'WhatsAppMessages', id: conversationId }],
        }),
        deleteWhatsAppMessage: builder.mutation<void, { conversationId: string; messageId: string; scope: 'me' | 'everyone' }>({
            query: ({ conversationId, messageId, scope }) => ({
                url: `/support/whatsapp/conversations/${conversationId}/messages/${messageId}?scope=${scope}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_r, _e, { conversationId }) => ['WhatsAppConversations', { type: 'WhatsAppMessages', id: conversationId }],
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
        // claim = take the chat (or take it over, with support.manage); release = let it go.
        setWhatsAppAssignment: builder.mutation<void, { conversationId: string; action: 'claim' | 'release' }>({
            query: ({ conversationId, action }) => ({
                url: `/support/whatsapp/conversations/${conversationId}/assignment`,
                method: 'POST',
                body: { action },
            }),
            invalidatesTags: (_r, _e, { conversationId }) => ['WhatsAppConversations', { type: 'WhatsAppDetails', id: conversationId }],
        }),
        getWhatsAppDetails: builder.query<WhatsAppCustomerDetails, string>({
            query: (conversationId) => `/support/whatsapp/conversations/${conversationId}/details`,
            transformResponse: (res: { data: WhatsAppCustomerDetails }) => res.data,
            providesTags: (_r, _e, conversationId) => [{ type: 'WhatsAppDetails', id: conversationId }],
        }),
        getWhatsAppNotes: builder.query<WhatsAppNote[], string>({
            query: (conversationId) => `/support/whatsapp/conversations/${conversationId}/notes`,
            transformResponse: (res: { data: WhatsAppNote[] }) => res.data ?? [],
            providesTags: (_r, _e, conversationId) => [{ type: 'WhatsAppNotes', id: conversationId }],
        }),
        addWhatsAppNote: builder.mutation<WhatsAppNote, { conversationId: string; body: string }>({
            query: ({ conversationId, body }) => ({
                url: `/support/whatsapp/conversations/${conversationId}/notes`,
                method: 'POST',
                body: { body },
            }),
            invalidatesTags: (_r, _e, { conversationId }) => [{ type: 'WhatsAppNotes', id: conversationId }],
        }),
        deleteWhatsAppNote: builder.mutation<void, { conversationId: string; noteId: string }>({
            query: ({ conversationId, noteId }) => ({
                url: `/support/whatsapp/conversations/${conversationId}/notes/${noteId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_r, _e, { conversationId }) => [{ type: 'WhatsAppNotes', id: conversationId }],
        }),
        markWhatsAppConversationRead: builder.mutation<void, string>({
            query: (conversationId) => ({
                url: `/support/whatsapp/conversations/${conversationId}/read`,
                method: 'POST',
            }),
            // Zero the badge immediately; the server broadcasts to other agents.
            async onQueryStarted(conversationId, { dispatch }) {
                dispatch(
                    whatsappApi.util.updateQueryData('getWhatsAppConversations', undefined, (draft) => {
                        const c = draft.find((x) => x.id === conversationId);
                        if (c) c.unreadCount = 0;
                    }),
                );
            },
        }),
    }),
});

export const {
    useGetWhatsAppConversationsQuery,
    useGetWhatsAppMessagesQuery,
    useSendWhatsAppMessageMutation,
    useSendWhatsAppMediaMutation,
    useStartWhatsAppCallMutation,
    useRequestWhatsAppCallPermissionMutation,
    useAcceptWhatsAppCallMutation,
    useRejectWhatsAppCallMutation,
    useEndWhatsAppCallMutation,
    useRetryWhatsAppMessageMutation,
    useEditWhatsAppMessageMutation,
    useDeleteWhatsAppMessageMutation,
    useSetWhatsAppAiMutation,
    useMarkWhatsAppConversationReadMutation,
    useSetWhatsAppAssignmentMutation,
    useGetWhatsAppDetailsQuery,
    useGetWhatsAppNotesQuery,
    useAddWhatsAppNoteMutation,
    useDeleteWhatsAppNoteMutation,
} = whatsappApi;
