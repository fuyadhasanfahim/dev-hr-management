'use client';

import {
    useState,
    useEffect,
    useRef,
    useCallback,
    type KeyboardEvent,
} from 'react';
import { useDispatch } from 'react-redux';
import type { Socket } from 'socket.io-client';
import {
    Send,
    UserCheck,
    X,
    Ticket,
    MessageSquare,
    Loader2,
    CheckCheck,
    Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
    useGetQueuedSessionsQuery,
    useGetActiveSessionsQuery,
    useClaimSessionMutation,
    useCloseSessionMutation,
    useConvertToTicketMutation,
    type ChatSession,
    type ChatMessage,
} from '@/store/api/chatApi';
import { baseApi } from '@/store/api/baseApi';
import { connectSocket } from '@/lib/socket';
import type { AppDispatch } from '@/store';
import { useSession } from '@/lib/auth-client';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString();
}

function formatClock(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getSessionUser(s: ChatSession): { name: string; email: string } {
    const u = s.clientId ?? s.guestId;
    return { name: u?.name ?? 'Unknown', email: u?.email ?? '' };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SessionSkeleton() {
    return (
        <div className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="size-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    );
}

interface SessionItemProps {
    session: ChatSession;
    isSelected: boolean;
    onSelect: () => void;
}

function SessionItem({ session, isSelected, onSelect }: SessionItemProps) {
    const user = getSessionUser(session);
    const initial = user.name.trim().charAt(0).toUpperCase() || '?';
    const isQueued = session.status === 'queued';

    return (
        <button
            onClick={onSelect}
            className={cn(
                'w-full flex items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-accent',
                isSelected && 'bg-accent',
            )}
        >
            <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {initial}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[13px] font-medium truncate">{user.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(session.updatedAt)}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                    {session.lastMessage?.content || 'No messages yet'}
                </p>
                {isQueued && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                        <Clock className="size-2.5" />
                        Waiting
                    </span>
                )}
                {session.assignedAgent && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <UserCheck className="size-2.5" />
                        {session.assignedAgent.name}
                    </span>
                )}
            </div>
        </button>
    );
}

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
    const isSystem = message.senderModel === 'System';
    if (isSystem) {
        return (
            <div className="flex justify-center my-2">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {message.content}
                </span>
            </div>
        );
    }

    return (
        <div className={cn('flex items-end gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
            {!isOwn && (
                <Avatar className="size-6 shrink-0 mb-0.5">
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                        {message.senderName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
            )}
            <div className={cn('max-w-[72%] space-y-0.5', isOwn ? 'items-end' : 'items-start')}>
                {!isOwn && (
                    <p className="text-[11px] text-muted-foreground px-1">{message.senderName}</p>
                )}
                <div
                    className={cn(
                        'px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
                        isOwn
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted text-foreground rounded-bl-sm',
                    )}
                >
                    {message.content}
                </div>
                <p className={cn('text-[10px] text-muted-foreground px-1', isOwn && 'text-right')}>
                    {formatClock(message.createdAt)}
                </p>
            </div>
        </div>
    );
}

function TypingIndicator({ names }: { names: string[] }) {
    if (names.length === 0) return null;
    const label = names.length === 1 ? `${names[0]} is typing` : 'Several people are typing';
    return (
        <div className="flex items-center gap-2 px-4 py-1.5">
            <div className="flex gap-0.5 items-center">
                <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
    );
}

// ─── main page ───────────────────────────────────────────────────────────────

type TabType = 'queued' | 'active';

export default function LiveChatPage() {
    const dispatch = useDispatch<AppDispatch>();
    const { data: authSession } = useSession();

    // RTK Query
    const { data: queuedSessions = [], isLoading: queuedLoading } = useGetQueuedSessionsQuery();
    const { data: activeSessions = [], isLoading: activeLoading } = useGetActiveSessionsQuery();
    const [claimSession, { isLoading: isClaiming }] = useClaimSessionMutation();
    const [closeSession, { isLoading: isClosing }] = useCloseSessionMutation();
    const [convertToTicket, { isLoading: isConverting }] = useConvertToTicketMutation();

    // UI state
    const [tab, setTab] = useState<TabType>('queued');
    const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [typingNames, setTypingNames] = useState<{ id: string; name: string }[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [sessionEnded, setSessionEnded] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentUserId = authSession?.user?.id ?? '';

    // ── socket bootstrap ──────────────────────────────────────────────────────
    useEffect(() => {
        const socket = connectSocket();
        socketRef.current = socket;

        const onConnect = () => {
            setSocketConnected(true);
            socket.emit('agent:register_presence');
        };

        const onDisconnect = () => setSocketConnected(false);

        const onQueueUpdate = () => {
            dispatch(baseApi.util.invalidateTags(['QueuedSessions']));
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('queue:new_message', onQueueUpdate);

        if (socket.connected) onConnect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('queue:new_message', onQueueUpdate);
        };
    }, [dispatch]);

    // ── join / leave session room ─────────────────────────────────────────────
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !selectedSession) return;

        setMessages([]);
        setTypingNames([]);
        setSessionEnded(
            selectedSession.status === 'ended' ||
            selectedSession.status === 'converted_to_ticket',
        );

        socket.emit('chat:join', { sessionId: selectedSession.sessionId });

        const onJoined = ({ messages: msgs }: { messages: ChatMessage[] }) => {
            setMessages(msgs ?? []);
        };

        const onMessage = (msg: ChatMessage) => {
            setMessages((prev) => {
                if (prev.some((m) => m._id === msg._id)) return prev;
                return [...prev, msg];
            });
        };

        const onTyping = ({
            userId,
            userName,
            isTyping,
        }: {
            userId: string;
            userName: string;
            isTyping: boolean;
        }) => {
            setTypingNames((prev) =>
                isTyping
                    ? prev.some((u) => u.id === userId)
                        ? prev
                        : [...prev, { id: userId, name: userName }]
                    : prev.filter((u) => u.id !== userId),
            );
        };

        const onClosed = () => {
            setSessionEnded(true);
            dispatch(baseApi.util.invalidateTags(['ActiveSessions', 'QueuedSessions']));
        };

        socket.on('chat:joined', onJoined);
        socket.on('chat:message', onMessage);
        socket.on('chat:typing', onTyping);
        socket.on('chat:closed', onClosed);

        return () => {
            socket.off('chat:joined', onJoined);
            socket.off('chat:message', onMessage);
            socket.off('chat:typing', onTyping);
            socket.off('chat:closed', onClosed);
        };
    }, [selectedSession?.sessionId, dispatch]);

    // ── auto-scroll ───────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── handlers ──────────────────────────────────────────────────────────────
    const handleSelectSession = useCallback((session: ChatSession) => {
        setSelectedSession(session);
    }, []);

    const handleClaim = useCallback(
        async (session: ChatSession) => {
            const result = await claimSession(session.sessionId);
            if ('data' in result && result.data) {
                setSelectedSession(result.data);
                setTab('active');
            }
        },
        [claimSession],
    );

    const handleClose = useCallback(async () => {
        if (!selectedSession) return;
        await closeSession(selectedSession.sessionId);
        setSessionEnded(true);
    }, [selectedSession, closeSession]);

    const handleConvert = useCallback(async () => {
        if (!selectedSession) return;
        const result = await convertToTicket({ sessionId: selectedSession.sessionId });
        if ('data' in result) {
            setSessionEnded(true);
        }
    }, [selectedSession, convertToTicket]);

    const emitTyping = useCallback(
        (isTyping: boolean) => {
            if (!selectedSession || !socketRef.current) return;
            socketRef.current.emit('chat:typing', {
                sessionId: selectedSession.sessionId,
                isTyping,
            });
        },
        [selectedSession],
    );

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setInputValue(e.target.value);

            if (!selectedSession) return;
            emitTyping(true);

            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => emitTyping(false), 2000);
        },
        [selectedSession, emitTyping],
    );

    const sendMessage = useCallback(() => {
        const text = inputValue.trim();
        if (!text || !selectedSession || !socketRef.current || sessionEnded) return;

        setIsSending(true);
        socketRef.current.emit(
            'chat:message',
            { sessionId: selectedSession.sessionId, text },
            () => setIsSending(false),
        );
        setInputValue('');
        emitTyping(false);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        setTimeout(() => setIsSending(false), 500); // fallback
    }, [inputValue, selectedSession, sessionEnded, emitTyping]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        },
        [sendMessage],
    );

    // ── render helpers ────────────────────────────────────────────────────────
    const sessionUser = selectedSession ? getSessionUser(selectedSession) : null;
    const canSend =
        selectedSession?.status === 'active' && !sessionEnded && socketConnected;
    const canClaim = selectedSession?.status === 'queued';

    const tabSessions = tab === 'queued' ? queuedSessions : activeSessions;
    const tabLoading = tab === 'queued' ? queuedLoading : activeLoading;

    return (
        <div className="flex h-full overflow-hidden">
            {/* ── Session list ──────────────────────────────────────────────── */}
            <aside className="w-[280px] shrink-0 flex flex-col border-r bg-background overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b">
                    {(['queued', 'active'] as const).map((t) => {
                        const count = t === 'queued' ? queuedSessions.length : activeSessions.length;
                        return (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-medium transition-colors border-b-2 -mb-px',
                                    tab === t
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {t === 'queued' ? 'Queued' : 'Active'}
                                {count > 0 && (
                                    <Badge
                                        variant={t === 'queued' ? 'destructive' : 'secondary'}
                                        className="h-4 min-w-4 px-1 text-[10px] leading-none"
                                    >
                                        {count}
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto divide-y divide-border/50">
                    {tabLoading ? (
                        Array.from({ length: 4 }).map((_, i) => <SessionSkeleton key={i} />)
                    ) : tabSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-3">
                                <MessageSquare className="size-4 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-foreground">No sessions</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {tab === 'queued'
                                    ? 'No clients are waiting.'
                                    : 'No active chats right now.'}
                            </p>
                        </div>
                    ) : (
                        tabSessions.map((s) => (
                            <SessionItem
                                key={s._id}
                                session={s}
                                isSelected={selectedSession?._id === s._id}
                                onSelect={() => handleSelectSession(s)}
                            />
                        ))
                    )}
                </div>

                {/* Socket status */}
                <div className="px-3 py-2 border-t flex items-center gap-1.5">
                    <span
                        className={cn(
                            'size-1.5 rounded-full',
                            socketConnected ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                    />
                    <span className="text-[11px] text-muted-foreground">
                        {socketConnected ? 'Connected' : 'Connecting…'}
                    </span>
                </div>
            </aside>

            {/* ── Chat window ───────────────────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {!selectedSession ? (
                    /* Empty state */
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-6">
                        <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
                            <MessageSquare className="size-6 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Select a chat session</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Choose a session from the list to start chatting.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 h-14 border-b shrink-0 gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="size-8 shrink-0">
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                                        {sessionUser?.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold truncate">
                                        {sessionUser?.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        {sessionUser?.email}
                                    </p>
                                </div>
                                <Badge
                                    variant={
                                        selectedSession.status === 'active'
                                            ? 'default'
                                            : selectedSession.status === 'queued'
                                                ? 'secondary'
                                                : 'outline'
                                    }
                                    className="text-[10px] px-2 py-0 h-5 shrink-0"
                                >
                                    {selectedSession.status === 'converted_to_ticket'
                                        ? 'Converted'
                                        : selectedSession.status}
                                </Badge>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                {canClaim && (
                                    <Button
                                        size="sm"
                                        variant="default"
                                        onClick={() => handleClaim(selectedSession)}
                                        disabled={isClaiming}
                                        className="h-7 text-xs gap-1.5"
                                    >
                                        {isClaiming ? (
                                            <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                            <UserCheck className="size-3" />
                                        )}
                                        Claim
                                    </Button>
                                )}
                                {selectedSession.status === 'active' && !sessionEnded && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleConvert}
                                            disabled={isConverting}
                                            className="h-7 text-xs gap-1.5"
                                        >
                                            {isConverting ? (
                                                <Loader2 className="size-3 animate-spin" />
                                            ) : (
                                                <Ticket className="size-3" />
                                            )}
                                            To Ticket
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleClose}
                                            disabled={isClosing}
                                            className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            {isClosing ? (
                                                <Loader2 className="size-3 animate-spin" />
                                            ) : (
                                                <X className="size-3" />
                                            )}
                                            Close
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {messages.length === 0 && (
                                <div className="flex justify-center py-8">
                                    <p className="text-xs text-muted-foreground">
                                        No messages yet. Be the first to say something!
                                    </p>
                                </div>
                            )}
                            {messages.map((msg) => (
                                <MessageBubble
                                    key={msg._id}
                                    message={msg}
                                    isOwn={msg.sender === currentUserId}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Typing indicator */}
                        <TypingIndicator names={typingNames.map((u) => u.name)} />

                        {/* Session ended banner */}
                        {sessionEnded && (
                            <div className="px-4 py-2.5 bg-muted/60 border-t text-center">
                                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                                    <CheckCheck className="size-3.5" />
                                    {selectedSession.status === 'converted_to_ticket'
                                        ? 'This chat was converted to a ticket.'
                                        : 'This chat session has ended.'}
                                </p>
                            </div>
                        )}

                        {/* Input */}
                        {!sessionEnded && (
                            <div className="px-4 py-3 border-t shrink-0">
                                {canClaim ? (
                                    <div className="flex items-center justify-center py-1">
                                        <p className="text-xs text-muted-foreground">
                                            Claim this session to start chatting.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={inputValue}
                                            onChange={handleInputChange}
                                            onKeyDown={handleKeyDown}
                                            placeholder={
                                                canSend
                                                    ? 'Type a message…'
                                                    : !socketConnected
                                                        ? 'Connecting…'
                                                        : 'Cannot send messages'
                                            }
                                            disabled={!canSend}
                                            className={cn(
                                                'flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm',
                                                'focus:outline-none focus:ring-1 focus:ring-ring',
                                                'placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed',
                                            )}
                                        />
                                        <Button
                                            size="icon"
                                            onClick={sendMessage}
                                            disabled={!canSend || !inputValue.trim() || isSending}
                                            className="size-9 shrink-0"
                                        >
                                            {isSending ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Send className="size-4" />
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
