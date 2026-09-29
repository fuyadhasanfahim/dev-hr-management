'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { useGetQueuedSessionsQuery } from '@/store/api/chatApi';
import { useGetWhatsAppConversationsQuery, whatsappApi, type WhatsAppMessageStatus } from '@/store/api/whatsappApi';
import { baseApi } from '@/store/api/baseApi';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useNotificationSound } from '@/hooks/use-notification-sound';
import type { AppDispatch } from '@/store';
import type { Socket } from 'socket.io-client';

// Live sidebar badge counts + the presence/ticket socket wiring behind them.
export function useLiveCounts() {
    const pathname = usePathname();
    const dispatch = useDispatch<AppDispatch>();
    const socketRef = useRef<Socket | null>(null);
    const pathnameRef = useRef(pathname);
    const [ticketCount, setTicketCount] = useState(0);
    const { playSound } = useNotificationSound();

    const { data: queuedSessions = [] } = useGetQueuedSessionsQuery(undefined, {
        pollingInterval: 30_000,
    });
    const liveChatCount = queuedSessions.length;

    const { data: whatsappConversations = [] } = useGetWhatsAppConversationsQuery(undefined, {
        pollingInterval: 30_000,
    });
    const messagesUnreadCount = whatsappConversations.reduce((sum, c) => sum + c.unreadCount, 0);

    // Clear the unread-ticket badge once the agent is looking at the tickets view.
    useEffect(() => {
        pathnameRef.current = pathname;
        if (pathname.startsWith('/tickets')) {
            const id = setTimeout(() => setTicketCount(0), 0);
            return () => clearTimeout(id);
        }
    }, [pathname]);

    useEffect(() => {
        const socket = connectSocket();
        socketRef.current = socket;

        const onConnect = () => socket.emit('agent:register_presence');
        const onQueueUpdate = () => {
            dispatch(baseApi.util.invalidateTags(['QueuedSessions']));
        };
        const onSessionStateChange = () => {
            dispatch(baseApi.util.invalidateTags(['QueuedSessions', 'ActiveSessions', 'UnreadCounts']));
        };
        // New ticket / new client reply — refresh ticket views live, and alert the
        // agent (sound + badge) unless they're already on the tickets page.
        const onTicketActivity = () => {
            dispatch(baseApi.util.invalidateTags(['Tickets', 'TicketDetail', 'DashboardStats']));
            if (!pathnameRef.current.startsWith('/tickets')) {
                setTicketCount((c) => c + 1);
                playSound();
            }
        };
        const onWhatsAppMessage = ({ conversationId }: { conversationId: string }) => {
            dispatch(
                baseApi.util.invalidateTags([
                    'WhatsAppConversations',
                    { type: 'WhatsAppMessages', id: conversationId },
                ]),
            );
            if (!pathnameRef.current.startsWith('/messages')) playSound();
        };
        // Tick updates (sent / delivered / read / failed) — patched in place so the
        // thread doesn't refetch and flicker on every status change.
        const onWhatsAppStatus = ({
            conversationId,
            messageId,
            status,
            error,
        }: {
            conversationId: string;
            messageId: string;
            status: WhatsAppMessageStatus;
            error?: string;
        }) => {
            dispatch(
                whatsappApi.util.updateQueryData('getWhatsAppMessages', conversationId, (draft) => {
                    const message = draft.find((m) => m.id === messageId);
                    if (message) {
                        message.status = status;
                        message.error = error ?? null;
                    }
                }),
            );
            dispatch(baseApi.util.invalidateTags(['WhatsAppConversations']));
        };

        socket.on('connect', onConnect);
        socket.on('queue:new_message', onQueueUpdate);
        socket.on('session:state_change', onSessionStateChange);
        socket.on('ticket:new_reply', onTicketActivity);
        socket.on('ticket:created', onTicketActivity);
        socket.on('whatsapp:new_message', onWhatsAppMessage);
        socket.on('whatsapp:message_status', onWhatsAppStatus);

        if (socket.connected) onConnect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('queue:new_message', onQueueUpdate);
            socket.off('session:state_change', onSessionStateChange);
            socket.off('ticket:new_reply', onTicketActivity);
            socket.off('ticket:created', onTicketActivity);
            socket.off('whatsapp:new_message', onWhatsAppMessage);
            socket.off('whatsapp:message_status', onWhatsAppStatus);
            disconnectSocket();
        };
    }, [dispatch, playSound]);

    return { liveChatCount, ticketCount, messagesUnreadCount };
}
