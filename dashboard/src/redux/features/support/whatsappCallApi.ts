import { apiSlice } from '@/redux/api/apiSlice';

// WhatsApp call actions, so an incoming call can be answered from the
// dashboard too (same endpoints the support app uses).
export const whatsappCallApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
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
    }),
});

export const {
    useStartWhatsAppCallMutation,
    useRequestWhatsAppCallPermissionMutation,
    useAcceptWhatsAppCallMutation,
    useRejectWhatsAppCallMutation,
    useEndWhatsAppCallMutation,
} = whatsappCallApi;
