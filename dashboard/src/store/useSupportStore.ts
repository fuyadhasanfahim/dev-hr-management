import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
    _id?: string;
    messageId?: string;
    sessionId: string;
    sender: string;
    senderModel: 'User' | 'Guest';
    senderName: string;
    content: string;
    attachments?: Array<{
        url: string;
        fileName: string;
        fileType: string;
        fileSize: number;
    }>;
    isInternal?: boolean;
    seenBy?: string[];
    createdAt: string;
}

export interface ChatSession {
    _id: string;
    sessionId: string;
    clientId?: { _id: string; name: string; email: string };
    guestId?: { _id: string; name: string; email: string };
    agentId?: { _id: string; name: string; email: string };
    status: 'queued' | 'active' | 'closed';
    createdAt: string;
    updatedAt: string;
    lastMessage?: {
        content: string;
        attachments?: unknown[];
        createdAt: string;
    } | null;
}

interface SupportState {
    token: string | null;
    guestEmail: string | null;
    activeSession: ChatSession | null;
    messages: ChatMessage[];
    typingUsers: Record<string, { name: string; isTyping: boolean }>;
    queuePosition: number;
    onlineAgentsCount: number;
    soundEnabled: boolean;
    queuedSessions: ChatSession[];
    activeSessions: ChatSession[];
    
    // Setters
    setToken: (token: string | null) => void;
    setGuestEmail: (email: string | null) => void;
    setActiveSession: (session: ChatSession | null) => void;
    setMessages: (messages: ChatMessage[]) => void;
    addMessage: (message: ChatMessage) => void;
    updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
    setTyping: (userId: string, name: string, isTyping: boolean) => void;
    setQueuePosition: (position: number) => void;
    setOnlineAgentsCount: (count: number) => void;
    toggleSound: () => void;
    setQueuedSessions: (sessions: ChatSession[]) => void;
    setActiveSessions: (sessions: ChatSession[]) => void;
    resetSupport: () => void;
}

export const useSupportStore = create<SupportState>()(
    persist(
        (set) => ({
            token: null,
            guestEmail: null,
            activeSession: null,
            messages: [],
            typingUsers: {},
            queuePosition: 0,
            onlineAgentsCount: 0,
            soundEnabled: true,
            queuedSessions: [],
            activeSessions: [],

            setToken: (token) => set({ token }),
            setGuestEmail: (guestEmail) => set({ guestEmail }),
            setActiveSession: (activeSession) => set({ activeSession }),
            setMessages: (messages) => set({ messages }),
            addMessage: (message) =>
                set((state) => {
                    const exists = state.messages.some(
                        (m) =>
                            (m._id && m._id === message._id) ||
                            (m.messageId && m.messageId === message.messageId)
                    );
                    if (exists) return state;
                    return { messages: [...state.messages, message] };
                }),
            updateMessage: (messageId, updates) =>
                set((state) => ({
                    messages: state.messages.map((m) =>
                        m._id === messageId || m.messageId === messageId
                            ? { ...m, ...updates }
                            : m
                    ),
                })),
            setTyping: (userId, name, isTyping) =>
                set((state) => ({
                    typingUsers: {
                        ...state.typingUsers,
                        [userId]: { name, isTyping },
                    },
                })),
            setQueuePosition: (queuePosition) => set({ queuePosition }),
            setOnlineAgentsCount: (onlineAgentsCount) => set({ onlineAgentsCount }),
            toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
            setQueuedSessions: (queuedSessions) => set({ queuedSessions }),
            setActiveSessions: (activeSessions) => set({ activeSessions }),
            resetSupport: () =>
                set({
                    token: null,
                    guestEmail: null,
                    activeSession: null,
                    messages: [],
                    typingUsers: {},
                    queuePosition: 0,
                    onlineAgentsCount: 0,
                    queuedSessions: [],
                    activeSessions: [],
                }),
        }),
        {
            name: 'devhr-support-store',
            partialize: (state) => ({
                token: state.token,
                guestEmail: state.guestEmail,
                soundEnabled: state.soundEnabled,
            }),
        }
    )
);
