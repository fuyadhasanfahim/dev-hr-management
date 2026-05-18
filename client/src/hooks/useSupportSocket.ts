import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSupportStore, ChatMessage } from '../store/useSupportStore';
import { useSession } from '@/lib/auth-client';
import { toast } from 'sonner';

const BACKEND_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';

// Global single socket reference to prevent multiple initializations
let supportSocket: Socket | null = null;

/**
 * Lightweight browser audio synthesizer for instant chat pings.
 */
function playPingSound() {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880.00, audioCtx.currentTime + 0.15); // A5

        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        // Safe bypass if audio context is blocked by browser policy
    }
}

export function useSupportSocket() {
    const { data: session } = useSession();
    const {
        token,
        activeSession,
        soundEnabled,
        addMessage,
        updateMessage,
        setTyping,
        setQueuePosition,
        setOnlineAgentsCount,
        setQueuedSessions,
        setActiveSessions,
        setActiveSession,
        resetSupport,
    } = useSupportStore();

    const [isConnected, setIsConnected] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initial connection routine
    useEffect(() => {
        const userRole = session?.user?.role;
        const isGuest = token !== null;
        
        // Handshake auth credentials
        const authData: any = {};
        if (isGuest) {
            authData.token = token;
        }

        // Initialize single connection
        if (!supportSocket) {
            supportSocket = io(`${BACKEND_URL}/support`, {
                auth: authData,
                autoConnect: false,
                transports: ['websocket'],
                reconnectionDelay: 2000,
                reconnectionDelayMax: 5000,
            });
        } else {
            // Update authorization handshake if it changes
            supportSocket.auth = authData;
        }

        const socket = supportSocket;

        if (!socket.connected) {
            socket.connect();
        }

        const handleConnect = () => {
            setIsConnected(true);
            // If active session is selected, rejoin immediately on reconnect
            if (activeSession?.sessionId) {
                socket.emit('chat:join', { sessionId: activeSession.sessionId });
            }
            // If staff, claim presence
            if (userRole && ['super_admin', 'admin', 'hr_manager', 'team_leader', 'staff'].includes(userRole)) {
                socket.emit('staff:join');
            }
        };

        const handleDisconnect = () => {
            setIsConnected(false);
        };

        const handleQueueUpdate = (data: { position: number; onlineAgents: number }) => {
            setQueuePosition(data.position);
            setOnlineAgentsCount(data.onlineAgents);
        };

        const handleMessage = (msg: ChatMessage) => {
            addMessage(msg);
            
            // Play notification ping if sender is not current user
            const currentUserId = session?.user?.id || 'guest';
            const isSelf = msg.sender === currentUserId;
            if (!isSelf && soundEnabled) {
                playPingSound();
            }

            // Emitted by agent or client, auto-seen if we are in this room
            if (!isSelf && activeSession?.sessionId === msg.sessionId) {
                socket.emit('chat:seen', { sessionId: msg.sessionId, messageId: msg._id || msg.messageId });
            }
        };

        const handleTyping = (data: { userId: string; name: string; isTyping: boolean }) => {
            setTyping(data.userId, data.name, data.isTyping);
        };

        const handleSeen = (data: { messageId: string; seenBy: string[] }) => {
            updateMessage(data.messageId, { seenBy: data.seenBy });
        };

        const handleAgentAssigned = (data: { session: any }) => {
            setActiveSession(data.session);
            toast.success(`Agent ${data.session.agentId?.name || 'Support'} has claimed the chat session.`);
        };

        const handleChatClosed = () => {
            toast.info('This support session has been resolved and closed.');
            // Re-fetch or clear
            resetSupport();
        };

        const handleStaffQueueUpdate = (data: { queued: any[]; active: any[] }) => {
            setQueuedSessions(data.queued);
            setActiveSessions(data.active);
        };

        // Register listeners
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('queue:update', handleQueueUpdate);
        socket.on('chat:message', handleMessage);
        socket.on('chat:typing', handleTyping);
        socket.on('chat:seen', handleSeen);
        socket.on('chat:agent_assigned', handleAgentAssigned);
        socket.on('chat:closed', handleChatClosed);
        socket.on('staff:queue_update', handleStaffQueueUpdate);

        // Handle direct checks if already connected
        if (socket.connected) {
            handleConnect();
        }

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('queue:update', handleQueueUpdate);
            socket.off('chat:message', handleMessage);
            socket.off('chat:typing', handleTyping);
            socket.off('chat:seen', handleSeen);
            socket.off('chat:agent_assigned', handleAgentAssigned);
            socket.off('chat:closed', handleChatClosed);
            socket.off('staff:queue_update', handleStaffQueueUpdate);
        };
    }, [session, token, activeSession?.sessionId, addMessage, updateMessage, setTyping, setQueuePosition, setOnlineAgentsCount, setQueuedSessions, setActiveSessions, setActiveSession, soundEnabled, resetSupport]);

    // Emit helper: Join specific conversation
    const joinChat = useCallback((sessionId: string) => {
        if (supportSocket?.connected) {
            supportSocket.emit('chat:join', { sessionId });
        }
    }, []);

    // Emit helper: Leave conversation room
    const leaveChat = useCallback((sessionId: string) => {
        if (supportSocket?.connected) {
            supportSocket.emit('chat:leave', { sessionId });
        }
    }, []);

    // Emit helper: Send message payload
    const sendMessage = useCallback((content: string, attachments: any[] = [], isInternal = false) => {
        if (!activeSession?.sessionId) return;
        if (supportSocket?.connected) {
            supportSocket.emit('chat:message', {
                sessionId: activeSession.sessionId,
                content,
                attachments,
                isInternal,
            });
        }
    }, [activeSession?.sessionId]);

    // Emit helper: Trigger typing notice
    const sendTyping = useCallback((isTyping: boolean) => {
        if (!activeSession?.sessionId) return;
        if (supportSocket?.connected) {
            supportSocket.emit('chat:typing', {
                sessionId: activeSession.sessionId,
                isTyping,
            });
        }
    }, [activeSession?.sessionId]);

    // Debounced typing trigger
    const triggerTyping = useCallback(() => {
        sendTyping(true);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            sendTyping(false);
        }, 1500);
    }, [sendTyping]);

    return {
        isConnected,
        joinChat,
        leaveChat,
        sendMessage,
        triggerTyping,
        socket: supportSocket,
    };
}
