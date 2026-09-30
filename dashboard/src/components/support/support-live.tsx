'use client';

import { useEffect, useRef } from 'react';
import { CallProvider } from '@/components/support/call-provider';
import { showWhatsAppMessageToast, type IncomingMessageEvent } from '@/components/support/whatsapp-message-toast';
import { useSupportAgent } from '@/hooks/use-support-agent';
import { connectSocket, onSocketEvent } from '@/lib/support-socket';

const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL ?? 'http://localhost:3001';

// Support staff don't have to keep support.webbriks.com open: new WhatsApp
// messages and incoming calls reach them here in the dashboard too.
function SupportAlerts() {
    const agent = useSupportAgent();
    const agentRef = useRef(agent);
    const sound = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
        agentRef.current = agent;
    }, [agent]);

    useEffect(() => {
        const socket = connectSocket();
        sound.current = new Audio('/sounds/notification.wav');
        const register = () => socket.emit('agent:register_presence');
        if (socket.connected) register();
        const offs = [
            onSocketEvent('connect', register),
            onSocketEvent('whatsapp:new_message', (event: IncomingMessageEvent) => {
                if (!event.fromCustomer) return;
                const me = agentRef.current;
                if (event.assignedTo && event.assignedTo.id !== me.id && !me.canManage) return;
                sound.current?.play().catch(() => {});
                showWhatsAppMessageToast(event, () =>
                    window.open(`${SUPPORT_URL}/messages/${event.conversationId}`, '_blank', 'noopener'),
                );
            }),
        ];
        return () => offs.forEach((off) => off());
    }, []);

    return null;
}

/**
 * The support inbox's live layer (call widget + message toasts), only for
 * staff with support access. A sibling of the page, not a wrapper, so the
 * app never remounts when permissions finish loading.
 */
export function SupportLive() {
    const { canAccess } = useSupportAgent();
    if (!canAccess) return null;
    return (
        <CallProvider>
            <SupportAlerts />
        </CallProvider>
    );
}
