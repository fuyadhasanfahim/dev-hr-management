'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSupportSocket } from '@/hooks/useSupportSocket';
import { useSupportStore } from '@/store/useSupportStore';
import { useS3Upload } from '@/hooks/useS3Upload';
import { useSession } from '@/lib/auth-client';
import { publicApiUrl } from '@/lib/public-api';
import {
    Headset,
    MessageSquare,
    ClipboardList,
    AlertCircle,
    User,
    Mail,
    Calendar,
    Paperclip,
    Send,
    Loader2,
    CheckSquare,
    Share2,
    Clock,
    Search,
    BookOpen,
    Eye,
    Plus,
    Lock,
    ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
    PriorityBadge,
    StatusBadge,
    AttachmentPreview,
    EmptySupportState,
    formatBytes,
    TypingIndicator,
} from '@/components/support/support-elements';

export default function StaffSupportConsole() {
    const { data: session } = useSession();
    const {
        queuedSessions,
        activeSessions,
        messages,
        typingUsers,
        setQueuedSessions,
        setActiveSessions,
        setMessages,
        addMessage,
        setActiveSession,
        activeSession,
    } = useSupportStore();

    const { isConnected, sendMessage, triggerTyping, joinChat, socket } = useSupportSocket();
    const { isUploading, uploadProgress, uploadFile } = useS3Upload();

    // Console navigation
    const [activeTab, setActiveTab] = useState<'chats' | 'tickets'>('chats');

    // Live chat active pane states
    const [selectedSession, setSelectedSession] = useState<any | null>(null);
    const [chatInput, setChatInput] = useState('');
    const [isInternalNote, setIsInternalNote] = useState(false);
    const [selectedChatFiles, setSelectedChatFiles] = useState<File[]>([]);
    const [uploadingChatFiles, setUploadingChatFiles] = useState<string[]>([]);
    const [actionLoading, setActionLoading] = useState(false);

    // Synchronize local selectedSession with global activeSession from socket hook / store
    useEffect(() => {
        if (!activeSession && selectedSession) {
            setSelectedSession(null);
        } else if (activeSession && (!selectedSession || selectedSession.sessionId !== activeSession.sessionId)) {
            setSelectedSession(activeSession);
        }
    }, [activeSession, selectedSession]);

    // Tickets hub states
    const [adminTickets, setAdminTickets] = useState<any[]>([]);
    const [selectedAdminTicket, setSelectedAdminTicket] = useState<any | null>(null);
    const [loadingTickets, setLoadingTickets] = useState(true);
    const [ticketSearch, setTicketSearch] = useState('');
    const [ticketReplyText, setTicketReplyText] = useState('');
    const [selectedTicketFiles, setSelectedTicketFiles] = useState<File[]>([]);
    const [uploadingTicketFiles, setUploadingTicketFiles] = useState<string[]>([]);
    const [submittingTicketReply, setSubmittingTicketReply] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const ticketThreadEndRef = useRef<HTMLDivElement>(null);
    const chatFileInputRef = useRef<HTMLInputElement>(null);
    const ticketFileInputRef = useRef<HTMLInputElement>(null);

    // Fetch lists from database
    const fetchSupportState = useCallback(async () => {
        try {
            // 1. Fetch live queues
            const qRes = await fetch(publicApiUrl('/api/support/chat/sessions/queued'), { credentials: 'include' });
            const aRes = await fetch(publicApiUrl('/api/support/chat/sessions/active'), { credentials: 'include' });

            if (qRes.ok) {
                const qData = await qRes.json();
                setQueuedSessions(qData.data || []);
            }
            if (aRes.ok) {
                const aData = await aRes.json();
                setActiveSessions(aData.data || []);
            }
        } catch (err) {
            // Bypass
        }
    }, [setQueuedSessions, setActiveSessions]);

    const fetchAdminTickets = useCallback(async () => {
        setLoadingTickets(true);
        try {
            const response = await fetch(publicApiUrl('/api/support/tickets'), { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setAdminTickets(data.data || []);
            }
        } catch (err) {
            // Bypass
        } finally {
            setLoadingTickets(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchSupportState();
        fetchAdminTickets();
    }, [fetchSupportState, fetchAdminTickets]);

    // Re-fetch tickets or chats when switching views
    useEffect(() => {
        if (activeTab === 'chats') {
            fetchSupportState();
        } else {
            fetchAdminTickets();
        }
    }, [activeTab, fetchSupportState, fetchAdminTickets]);

    // Auto-scroll chats
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, typingUsers]);

    // Auto-scroll ticket thread replies
    useEffect(() => {
        if (ticketThreadEndRef.current) {
            ticketThreadEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [selectedAdminTicket?.replies]);

    // Handle session selection & loading message logs
    const handleSelectSession = async (sessionItem: any) => {
        setSelectedSession(sessionItem);
        setActiveSession(sessionItem);
        joinChat(sessionItem.sessionId);
        setMessages([]); // reset list

        try {
            const response = await fetch(publicApiUrl(`/api/support/chat/sessions/${sessionItem.sessionId}/messages`), { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setMessages(data.data || []);
            }
        } catch (err) {
            toast.error('Failed to load conversation logs.');
        }
    };

    // Staff Claim Session
    const handleClaimSession = async (sessionId: string) => {
        setActionLoading(true);
        try {
            const response = await fetch(publicApiUrl(`/api/support/chat/sessions/${sessionId}/claim`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to claim support session.');
            }

            const { data } = await response.json();
            toast.success('Live support session claimed successfully!');
            fetchSupportState();
            handleSelectSession(data);
        } catch (err: any) {
            toast.error(err.message || 'Claim error.');
        } finally {
            setActionLoading(false);
        }
    };

    // Staff Close Session
    const handleCloseSession = async () => {
        if (!selectedSession) return;
        if (!confirm('Are you sure you want to resolve and close this active support chat?')) return;

        setActionLoading(true);
        try {
            // Emit socket event to notify room immediately (both guest and agent)
            if (socket?.connected) {
                socket.emit('chat:close', { sessionId: selectedSession.sessionId });
            }

            const response = await fetch(publicApiUrl(`/api/support/chat/sessions/${selectedSession.sessionId}/close`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to close session.');
            }

            toast.info('Chat session closed and archived.');
            setSelectedSession(null);
            setActiveSession(null);
            fetchSupportState();
        } catch (err: any) {
            toast.error(err.message || 'Close error.');
        } finally {
            setActionLoading(false);
        }
    };

    // Staff Convert Live Chat to Ticket
    const handleConvertChatToTicket = async () => {
        if (!selectedSession) return;
        if (!confirm('Convert this live support chat into a formal Support Ticket? This ends the active live chat session.')) return;

        setActionLoading(true);
        try {
            const response = await fetch(publicApiUrl(`/api/support/chat/sessions/${selectedSession.sessionId}/convert`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Could not convert live chat session.');
            }

            const { data } = await response.json();
            toast.success(`Chat successfully converted to Ticket: ${data.ticketId}`);
            setSelectedSession(null);
            setActiveSession(null);
            fetchSupportState();
            fetchAdminTickets();
        } catch (err: any) {
            toast.error(err.message || 'Conversion failed.');
        } finally {
            setActionLoading(false);
        }
    };

    // Staff Chat Message submit
    const handleSendChatMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() && selectedChatFiles.length === 0) return;
        if (!selectedSession) return;

        let attachments: any[] = [];
        if (selectedChatFiles.length > 0) {
            try {
                for (const file of selectedChatFiles) {
                    setUploadingChatFiles((prev) => [...prev, file.name]);
                    const res = await uploadFile(file, selectedSession.sessionId);
                    attachments.push(res);
                    setUploadingChatFiles((prev) => prev.filter((n) => n !== file.name));
                }
            } catch (err) {
                toast.error('Failed to upload some media attachments to S3.');
                setUploadingChatFiles([]);
                return;
            }
        }

        // Emit socket
        sendMessage(chatInput, attachments, isInternalNote);

        setChatInput('');
        setSelectedChatFiles([]);
        setIsInternalNote(false);
    };

    // Ticket reply submit
    const handleSendTicketReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ticketReplyText.trim() && selectedTicketFiles.length === 0) return;
        if (!selectedAdminTicket) return;

        setSubmittingTicketReply(true);
        let attachments: any[] = [];

        try {
            for (const file of selectedTicketFiles) {
                setUploadingTicketFiles((prev) => [...prev, file.name]);
                const res = await uploadFile(file, selectedAdminTicket._id);
                attachments.push(res);
                setUploadingTicketFiles((prev) => prev.filter((n) => n !== file.name));
            }

            const response = await fetch(publicApiUrl(`/api/support/tickets/${selectedAdminTicket._id}/reply`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: ticketReplyText,
                    attachments,
                }),
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Could not submit reply.');
            }

            const { data } = await response.json();
            setSelectedAdminTicket((prev: any) => ({
                ...prev,
                replies: [...(prev.replies || []), data],
            }));

            setTicketReplyText('');
            setSelectedTicketFiles([]);
            toast.success('Ticket response submitted successfully.');
        } catch (err: any) {
            toast.error(err.message || 'Reply failed.');
            setUploadingTicketFiles([]);
        } finally {
            setSubmittingTicketReply(false);
        }
    };

    // Ticket status update
    const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
        try {
            const response = await fetch(publicApiUrl(`/api/support/tickets/${ticketId}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to update status.');
            }

            toast.success(`Ticket status updated to ${status}.`);
            fetchAdminTickets();
            if (selectedAdminTicket && selectedAdminTicket._id === ticketId) {
                setSelectedAdminTicket((prev: any) => ({ ...prev, status }));
            }
        } catch (err: any) {
            toast.error(err.message || 'Status transition error.');
        }
    };

    // Ticket assignment update
    const handleAssignTicket = async (ticketId: string) => {
        try {
            const response = await fetch(publicApiUrl(`/api/support/tickets/${ticketId}/assign`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to claim ticket assignment.');
            }

            toast.success('Ticket assigned to you.');
            fetchAdminTickets();
            if (selectedAdminTicket && selectedAdminTicket._id === ticketId) {
                setSelectedAdminTicket((prev: any) => ({
                    ...prev,
                    assignedTo: { _id: session?.user?.id, name: session?.user?.name },
                }));
            }
        } catch (err: any) {
            toast.error(err.message || 'Assignment error.');
        }
    };

    // Filter tickets list
    const filteredAdminTickets = adminTickets.filter((ticket) => {
        return (
            ticket.subject.toLowerCase().includes(ticketSearch.toLowerCase()) ||
            ticket.ticketId.toLowerCase().includes(ticketSearch.toLowerCase())
        );
    });

    return (
        <div className="flex flex-col h-screen overflow-hidden select-none">
            {/* ── HEADER ── */}
            <div className="flex-none border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-indigo-500/30 text-indigo-500 shadow-md shadow-violet-500/5 dark:shadow-none animate-pulse">
                        <Headset className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">Support Operations Console</h1>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                            Manage customer tickets, claim queues, and hold live agent discussions.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── TABS ── */}
            <Tabs
                value={activeTab}
                onValueChange={(v) => {
                    if (v === 'chats') {
                        setActiveTab('chats');
                        setSelectedAdminTicket(null);
                    } else {
                        setActiveTab('tickets');
                        setSelectedSession(null);
                    }
                }}
                className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
                <div className="flex-none border-b px-6">
                    <TabsList className="h-12 rounded-none bg-transparent p-0 gap-6 border-0 justify-start">
                        <TabsTrigger
                            value="chats"
                            className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 h-full text-sm font-semibold text-muted-foreground transition-colors"
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Live Chats
                            <Badge variant="secondary" className="ml-1 h-5 text-[10px] px-1.5 font-bold">
                                {queuedSessions.length + activeSessions.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="tickets"
                            className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 h-full text-sm font-semibold text-muted-foreground transition-colors"
                        >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Ticketing Hub
                            <Badge variant="secondary" className="ml-1 h-5 text-[10px] px-1.5 font-bold">
                                {adminTickets.filter(t => t.status !== 'closed').length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ── CHATS TAB ── */}
                <TabsContent value="chats" className="flex flex-1 min-h-0 overflow-hidden m-0 data-[state=inactive]:hidden">
                    {/* LEFT SIDEBAR: Queues */}
                    <div className="w-80 flex-none border-r flex flex-col overflow-hidden">
                        <div className="flex-none p-4 border-b bg-muted/20">
                            <h3 className="text-xs font-bold flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Active Connection Queues
                            </h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Real-time claiming wait lines.</p>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-3 space-y-4">
                                {/* Waiting queue */}
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-wider px-1 flex items-center gap-1">
                                        Waiting Queue
                                        <Badge className="ml-1 h-4 text-[9px] px-1.5 font-bold bg-rose-500/10 text-rose-500 hover:bg-rose-500/10 border-rose-500/20 border">
                                            {queuedSessions.length}
                                        </Badge>
                                    </h4>
                                    {queuedSessions.length === 0 ? (
                                        <div className="p-4 rounded-xl border border-dashed text-center">
                                            <p className="text-[10px] font-medium text-muted-foreground">No chats waiting in queue.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {queuedSessions.map((sessionItem) => (
                                                <div
                                                    key={sessionItem._id}
                                                    className="p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] hover:bg-rose-500/[0.07] flex flex-col gap-2.5 transition-all duration-300 shadow-sm group"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-bold tracking-wider text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full uppercase">
                                                            Unclaimed Queue
                                                        </span>
                                                        <span className="text-[9px] text-muted-foreground flex items-center gap-1 font-semibold">
                                                            <Clock className="w-3 h-3 text-rose-500/70" />
                                                            {new Date(sessionItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-foreground truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                                            {sessionItem.clientId?.name || sessionItem.guestId?.name || 'Guest User'}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground truncate font-medium mt-0.5">
                                                            {sessionItem.clientId?.email || sessionItem.guestId?.email || 'No Email Registered'}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleClaimSession(sessionItem.sessionId)}
                                                        disabled={actionLoading}
                                                        className="w-full text-[10px] font-semibold bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-md rounded-xl"
                                                    >
                                                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Claim Conversation'}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Claimed chats */}
                                <div className="space-y-2 border-t pt-4">
                                    <h4 className="text-[10px] font-bold text-violet-500 uppercase tracking-wider px-1 flex items-center gap-1">
                                        Your Claimed Chats
                                        <Badge className="ml-1 h-4 text-[9px] px-1.5 font-bold bg-violet-500/10 text-violet-500 hover:bg-violet-500/10 border-violet-500/20 border">
                                            {activeSessions.length}
                                        </Badge>
                                    </h4>
                                    {activeSessions.length === 0 ? (
                                        <div className="p-4 rounded-xl border border-dashed text-center">
                                            <p className="text-[10px] font-medium text-muted-foreground">You have no active claimed chats.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {activeSessions.map((sessionItem) => {
                                                const isSelected = selectedSession?.sessionId === sessionItem.sessionId;
                                                const clientName = sessionItem.clientId?.name || sessionItem.guestId?.name || 'Customer';
                                                const clientEmail = sessionItem.clientId?.email || sessionItem.guestId?.email || 'No email';
                                                const lastMsg = sessionItem.lastMessage;
                                                const hasAttachments = lastMsg?.attachments && lastMsg.attachments.length > 0;
                                                const timeStr = lastMsg
                                                    ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : new Date(sessionItem.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                const initials = clientName
                                                    .split(' ')
                                                    .map((n: string) => n[0])
                                                    .join('')
                                                    .substring(0, 2)
                                                    .toUpperCase();

                                                return (
                                                    <div
                                                        key={sessionItem._id}
                                                        onClick={() => handleSelectSession(sessionItem)}
                                                        className={`p-3 rounded-xl border flex gap-3 transition-all cursor-pointer duration-300 ${
                                                            isSelected
                                                                ? 'bg-violet-600/[0.04] dark:bg-violet-600/[0.08] border-violet-500/30 border-l-[3.5px] border-l-violet-600 pl-2.5 shadow-sm'
                                                                : 'border-border/50 bg-card/45 hover:bg-card hover:border-border'
                                                        }`}
                                                    >
                                                        <div className="shrink-0 flex items-center">
                                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold tracking-wider shadow-sm transition-all duration-300 ${
                                                                isSelected
                                                                    ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white scale-105'
                                                                    : 'bg-muted text-muted-foreground border border-border/40'
                                                            }`}>
                                                                {initials || <User className="w-3.5 h-3.5" />}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-w-0 flex flex-col justify-center leading-tight">
                                                            <div className="flex items-center justify-between gap-1.5">
                                                                <span className="text-xs font-bold text-foreground truncate max-w-[70%]">{clientName}</span>
                                                                <span className="text-[9px] text-muted-foreground shrink-0 font-semibold">{timeStr}</span>
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground truncate font-medium mt-0.5">{clientEmail}</div>
                                                            <div className="flex items-center gap-1 mt-1.5 min-w-0">
                                                                {hasAttachments && <Paperclip className="w-3 h-3 text-violet-500 shrink-0" />}
                                                                <p className="text-[10px] text-muted-foreground/80 line-clamp-1 truncate w-full">
                                                                    {lastMsg ? lastMsg.content : 'No messages yet'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </div>

                    {/* CENTER + RIGHT: Chat window */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {!selectedSession ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                <div className="max-w-md space-y-6">
                                    <div className="relative inline-flex mx-auto">
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 blur-xl scale-125 animate-pulse" />
                                        <div className="relative p-6 rounded-full bg-card border border-violet-500/20 shadow-lg">
                                            <MessageSquare className="w-10 h-10 animate-bounce text-violet-500" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-bold tracking-tight">No Active Live Chat Claimed</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto font-medium">
                                            Select a conversation from your claimed list on the left, or claim an incoming request from the waiting queue to begin real-time operations.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-muted-foreground/80 font-medium">
                                        <span className="px-2.5 py-1 rounded-full bg-muted border flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                            Live Socket Active
                                        </span>
                                        <span className="px-2.5 py-1 rounded-full bg-muted border flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            Claim-ready Queues
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-1 overflow-hidden">
                                {/* MESSAGE STREAM */}
                                <div className="flex-1 flex flex-col overflow-hidden border-r">
                                    {/* Chat header */}
                                    <div className="flex-none border-b px-5 py-3.5 flex items-center justify-between bg-muted/20">
                                        <div className="min-w-0 pr-1">
                                            <h4 className="text-sm font-bold truncate">
                                                {selectedSession.clientId?.name || selectedSession.guestId?.name || 'Customer'}
                                            </h4>
                                            <p className="text-[10px] text-muted-foreground truncate font-medium mt-0.5">
                                                {selectedSession.clientId?.email || selectedSession.guestId?.email || 'No email profile'}
                                            </p>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleConvertChatToTicket}
                                                disabled={actionLoading}
                                                className="text-[10px] h-8 gap-1.5 font-bold"
                                            >
                                                <Share2 className="w-3.5 h-3.5 text-violet-500" />
                                                Convert to Ticket
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={handleCloseSession}
                                                disabled={actionLoading}
                                                className="text-[10px] h-8 gap-1.5 font-bold"
                                            >
                                                <CheckSquare className="w-3.5 h-3.5" />
                                                Close Chat
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Message thread */}
                                    <ScrollArea className="flex-1">
                                        <div className="px-5 py-4 space-y-4 pr-6">
                                            {messages.map((msg, idx) => {
                                                const isSelf = msg.sender === session?.user?.id;
                                                const seen = msg.seenBy && msg.seenBy.length > 0;
                                                const isInternal = msg.isInternal;

                                                return (
                                                    <div key={idx} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                                                        <div className="flex items-baseline gap-1.5 mb-0.5 px-1.5">
                                                            <span className={`text-[11px] font-bold ${
                                                                isInternal
                                                                    ? 'text-amber-600 dark:text-amber-400 font-extrabold'
                                                                    : 'text-slate-700 dark:text-slate-300'
                                                            }`}>
                                                                {isSelf ? 'You' : msg.senderName}
                                                            </span>
                                                            <span className="text-[9px] text-muted-foreground/80 font-medium">
                                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>

                                                        {isInternal ? (
                                                            <div className="bg-amber-500/[0.05] dark:bg-amber-500/[0.08] text-amber-900 dark:text-amber-200 border-l-4 border-l-amber-500 border-y border-r border-amber-500/20 px-4 py-3 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm">
                                                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                                                                    <Lock className="w-3 h-3 shrink-0" />
                                                                    <span>Internal Private Note</span>
                                                                </div>
                                                                <p className="whitespace-pre-wrap break-words text-xs sm:text-sm font-medium leading-relaxed">{msg.content}</p>
                                                                {msg.attachments && msg.attachments.length > 0 && (
                                                                    <div className="space-y-1.5 mt-2.5 pt-2 border-t border-amber-500/10">
                                                                        {msg.attachments.map((file: any, fIdx: number) => (
                                                                            <a key={fIdx} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 hover:underline">
                                                                                <Paperclip className="w-3 h-3 shrink-0" />
                                                                                <span className="truncate max-w-[200px]">{file.fileName}</span>
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed shadow-sm ${
                                                                isSelf
                                                                    ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-none border border-violet-500/15'
                                                                    : 'bg-card text-foreground rounded-tl-none border'
                                                            }`}>
                                                                <p className="whitespace-pre-wrap break-words font-medium">{msg.content}</p>
                                                                {msg.attachments && msg.attachments.length > 0 && (
                                                                    <div className={`space-y-1 mt-2 pt-2 border-t ${isSelf ? 'border-white/10' : 'border-border/50'}`}>
                                                                        {msg.attachments.map((file: any, fIdx: number) => (
                                                                            <a key={fIdx} href={file.url} target="_blank" rel="noreferrer" className={`flex items-center gap-1 text-[10px] font-semibold hover:underline ${isSelf ? 'text-white/80' : 'text-violet-600 dark:text-violet-400'}`}>
                                                                                <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                                                                <span className="truncate max-w-[200px]">{file.fileName}</span>
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {isSelf && !isInternal && (
                                                            <div className="text-[8px] text-muted-foreground/80 mt-0.5 mr-1.5 font-bold uppercase tracking-wider">
                                                                {seen ? 'Seen' : 'Sent'}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {Object.entries(typingUsers).map(([userId, user]) => {
                                                if (userId === session?.user?.id || !(user as any).isTyping) return null;
                                                return (
                                                    <div key={userId} className="flex flex-col items-start px-1.5">
                                                        <TypingIndicator label={`${(user as any).name} is typing...`} />
                                                    </div>
                                                );
                                            })}
                                            <div ref={chatEndRef} />
                                        </div>
                                    </ScrollArea>

                                    {/* Chat input */}
                                    <div className="flex-none border-t p-3 flex flex-col gap-3 bg-muted/10">
                                        {isUploading && (
                                            <div className="p-3 border rounded-xl space-y-1.5 bg-card shadow-sm">
                                                <div className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">Uploading media directly to S3...</div>
                                                {Object.entries(uploadProgress).map(([name, progress]) => (
                                                    <Progress key={name} value={progress} className="h-1" />
                                                ))}
                                            </div>
                                        )}

                                        {selectedChatFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedChatFiles.map((file, idx) => (
                                                    <div key={idx} className="flex items-center gap-1.5 bg-card px-3 py-1 rounded-full text-[10px] border max-w-xs shadow-sm font-semibold">
                                                        <span className="truncate">{file.name}</span>
                                                        <button onClick={() => setSelectedChatFiles(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-600 transition-colors ml-1">
                                                            <Plus className="w-3.5 h-3.5 rotate-45" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <form onSubmit={handleSendChatMessage} className="flex flex-col gap-3 bg-card border rounded-2xl p-3 shadow-sm">
                                            <div className="flex items-center justify-between border-b pb-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <input type="file" ref={chatFileInputRef} onChange={(e) => setSelectedChatFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" multiple />
                                                    <Button type="button" variant="outline" size="sm" onClick={() => chatFileInputRef.current?.click()} disabled={isUploading} className="text-[10px] h-7 gap-1.5 font-bold">
                                                        <Paperclip className="w-3.5 h-3.5 text-violet-500" />
                                                        Add Files
                                                    </Button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsInternalNote(!isInternalNote)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all duration-300 cursor-pointer ${
                                                        isInternalNote
                                                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                                            : 'bg-background text-muted-foreground border-border hover:bg-muted'
                                                    }`}
                                                >
                                                    <Lock className="w-3.5 h-3.5" />
                                                    <span>{isInternalNote ? 'Secure Note Mode' : 'Internal Private Note'}</span>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isInternalNote ? 'bg-amber-500 animate-pulse' : 'bg-transparent'}`} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <Input
                                                    placeholder={isInternalNote ? 'Write a secure internal note (visible only to system operators)...' : 'Type public agent message...'}
                                                    value={chatInput}
                                                    onChange={(e) => { setChatInput(e.target.value); triggerTyping(); }}
                                                    className={`h-10 text-xs rounded-xl ${isInternalNote ? 'border-amber-500/30 focus-visible:ring-amber-500/20' : ''}`}
                                                />
                                                <Button
                                                    type="submit"
                                                    size="icon"
                                                    disabled={!chatInput.trim() && selectedChatFiles.length === 0}
                                                    className={`w-10 h-10 rounded-xl shrink-0 shadow-md transition-all duration-300 hover:scale-105 active:scale-95 ${
                                                        isInternalNote
                                                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white'
                                                    }`}
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                {/* RIGHT: Customer context */}
                                <div className="w-72 flex-none border-l flex flex-col overflow-hidden">
                                    <ScrollArea className="flex-1 p-4">
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Customer Context</h4>
                                                <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Detailed identity verification audit.</p>
                                            </div>

                                            <div className="flex flex-col gap-1 p-3 rounded-xl border bg-card shadow-sm">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">User Name</span>
                                                <span className="text-xs font-bold flex items-center gap-1.5 mt-0.5">
                                                    <User className="w-4 h-4 text-violet-500" />
                                                    {selectedSession.clientId?.name || selectedSession.guestId?.name}
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1 p-3 rounded-xl border bg-card shadow-sm">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">Email Profile</span>
                                                <span className="text-xs font-bold flex items-center gap-1.5 mt-0.5 truncate">
                                                    <Mail className="w-4 h-4 text-violet-500" />
                                                    {selectedSession.clientId?.email || selectedSession.guestId?.email}
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1.5 p-3 rounded-xl border bg-card shadow-sm">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">Verification Class</span>
                                                <div className="mt-0.5">
                                                    {selectedSession.clientId ? (
                                                        <Badge variant="outline" className="text-[10px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20">
                                                            Authenticated User
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                                                            Unverified Guest
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1 p-3 rounded-xl border bg-card shadow-sm">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">Conversation Initiated</span>
                                                <span className="text-xs font-bold flex items-center gap-1.5 mt-0.5">
                                                    <Calendar className="w-4 h-4 text-violet-500" />
                                                    {new Date(selectedSession.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ── TICKETS TAB ── */}
                <TabsContent value="tickets" className="flex flex-1 min-h-0 overflow-hidden m-0 data-[state=inactive]:hidden">
                    {/* LEFT: Ticket list */}
                    <div className="w-80 flex-none border-r flex flex-col overflow-hidden">
                        <div className="flex-none p-4 border-b bg-muted/20 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by ID or subject..."
                                    value={ticketSearch}
                                    onChange={(e) => setTicketSearch(e.target.value)}
                                    className="pl-9 text-xs h-9 rounded-xl"
                                />
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            {loadingTickets ? (
                                <div className="p-3 space-y-3">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="h-20 w-full rounded-2xl bg-muted animate-pulse border border-border/30" />
                                    ))}
                                </div>
                            ) : filteredAdminTickets.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                                    No tickets in system.
                                </div>
                            ) : (
                                <div className="p-3 space-y-2">
                                    {filteredAdminTickets.map((ticketItem) => {
                                        const isSelected = selectedAdminTicket?._id === ticketItem._id;
                                        return (
                                            <div
                                                key={ticketItem._id}
                                                onClick={async () => {
                                                    setSelectedAdminTicket(ticketItem);
                                                    try {
                                                        const res = await fetch(`/api/support/tickets/${ticketItem._id}`);
                                                        if (res.ok) {
                                                            const data = await res.json();
                                                            setSelectedAdminTicket(data.data);
                                                        }
                                                    } catch (e) {}
                                                }}
                                                className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all duration-300 cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-violet-600/[0.04] dark:bg-violet-600/[0.08] border-violet-500/30 border-l-[3.5px] border-l-violet-600 pl-2.5 shadow-sm'
                                                        : 'border-border/50 bg-card/45 hover:bg-card'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-muted-foreground tracking-wide">{ticketItem.ticketId}</span>
                                                    <PriorityBadge priority={ticketItem.priority} />
                                                </div>
                                                <h4 className="text-xs font-bold text-foreground truncate pr-1">{ticketItem.subject}</h4>
                                                <div className="flex items-center justify-between mt-1">
                                                    <StatusBadge status={ticketItem.status} />
                                                    <span className="text-[9px] text-muted-foreground flex items-center gap-1 font-semibold">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {new Date(ticketItem.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* RIGHT: Ticket detail */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {!selectedAdminTicket ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                <div className="max-w-md space-y-6">
                                    <div className="relative inline-flex mx-auto">
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 blur-xl scale-125 animate-pulse" />
                                        <div className="relative p-6 rounded-full bg-card border border-violet-500/20 shadow-lg">
                                            <ClipboardList className="w-10 h-10 animate-bounce text-violet-500" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-bold tracking-tight">No Ticket Selected</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto font-medium">
                                            Select a formal ticket from the search table on the left to claim agent assignments, respond directly, view attached media, and edit status progressions.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-1 overflow-hidden">
                                {/* TICKET THREAD */}
                                <div className="flex-1 flex flex-col overflow-hidden border-r">
                                    {/* Header */}
                                    <div className="flex-none border-b px-5 py-3.5 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-muted-foreground tracking-wider">{selectedAdminTicket.ticketId}</span>
                                                <PriorityBadge priority={selectedAdminTicket.priority} />
                                            </div>
                                            <h4 className="text-xs sm:text-sm font-bold truncate">{selectedAdminTicket.subject}</h4>
                                        </div>
                                        <select
                                            value={selectedAdminTicket.status}
                                            onChange={(e) => handleUpdateTicketStatus(selectedAdminTicket._id, e.target.value)}
                                            className="text-[10px] font-bold border rounded-xl p-1.5 bg-card text-foreground cursor-pointer shadow-sm hover:bg-muted transition-colors"
                                        >
                                            <option value="open">Open</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="pending_client">Pending Customer</option>
                                            <option value="resolved">Resolved</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                    </div>

                                    {/* Timeline */}
                                    <ScrollArea className="flex-1">
                                        <div className="px-5 py-4 space-y-5 pr-6">
                                            {/* Original submission */}
                                            <div className="p-4 rounded-2xl border border-dashed border-violet-500/20 bg-violet-500/[0.02] dark:bg-violet-500/[0.04] space-y-3.5 shadow-sm">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                                                    <span className="flex items-center gap-1.5 text-foreground">
                                                        <User className="w-4 h-4 text-violet-500" />
                                                        {selectedAdminTicket.clientId?.name || selectedAdminTicket.guestId?.name} (Original Request)
                                                    </span>
                                                    <span>{new Date(selectedAdminTicket.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                </div>
                                                <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium">{selectedAdminTicket.text}</p>
                                                {selectedAdminTicket.attachments && selectedAdminTicket.attachments.length > 0 && (
                                                    <div className="space-y-1.5 pt-3 border-t">
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedAdminTicket.attachments.map((file: any, idx: number) => (
                                                                <a key={idx} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 p-1.5 px-3 rounded-xl border text-[10px] font-semibold bg-card hover:bg-muted truncate max-w-[200px] shadow-sm transition-colors">
                                                                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                                                                    <span className="truncate">{file.fileName}</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Reply thread */}
                                            {selectedAdminTicket.replies && selectedAdminTicket.replies.map((reply: any, idx: number) => {
                                                const isAgent = reply.senderType === 'staff';
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`p-4 rounded-2xl border transition-all duration-300 shadow-sm space-y-2 ${
                                                            isAgent
                                                                ? 'bg-violet-500/[0.03] dark:bg-violet-500/[0.06] border-violet-500/15 border-l-4 border-l-violet-600 pl-3.5'
                                                                : 'bg-card border-border/80'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                                                            <span className={`flex items-center gap-1.5 ${isAgent ? 'text-violet-600 dark:text-violet-400 font-extrabold' : 'text-foreground font-bold'}`}>
                                                                {isAgent ? <Headset className="w-3.5 h-3.5 text-violet-500" /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                                                                {reply.senderId?.name || (isAgent ? 'Agent Admin' : 'Customer')}
                                                            </span>
                                                            <span className="font-semibold">{new Date(reply.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                        </div>
                                                        <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium">{reply.content}</p>
                                                        {reply.attachments && reply.attachments.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                                                                {reply.attachments.map((file: any, fIdx: number) => (
                                                                    <a key={fIdx} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 p-1.5 px-3 rounded-xl border text-[10px] font-semibold bg-card hover:bg-muted truncate max-w-[200px] shadow-sm transition-colors">
                                                                        <Paperclip className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                                                                        <span className="truncate">{file.fileName}</span>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            <div ref={ticketThreadEndRef} />
                                        </div>
                                    </ScrollArea>

                                    {/* Reply input */}
                                    <div className="flex-none border-t p-4 flex flex-col gap-3 bg-muted/10">
                                        {isUploading && (
                                            <div className="p-3 border rounded-xl bg-card space-y-1.5 shadow-sm">
                                                <div className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">Uploading media directly to S3...</div>
                                                {Object.entries(uploadProgress).map(([name, progress]) => (
                                                    <Progress key={name} value={progress} className="h-1" />
                                                ))}
                                            </div>
                                        )}
                                        {selectedTicketFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedTicketFiles.map((file, idx) => (
                                                    <div key={idx} className="flex items-center gap-1.5 bg-card px-3 py-1 rounded-full text-[10px] border max-w-xs shadow-sm font-semibold">
                                                        <span className="truncate">{file.name}</span>
                                                        <button onClick={() => setSelectedTicketFiles(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-600 ml-1">
                                                            <Plus className="w-3.5 h-3.5 rotate-45" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <form onSubmit={handleSendTicketReply} className="flex flex-col gap-3 bg-card border rounded-2xl p-3 shadow-sm">
                                            <Textarea
                                                placeholder="Write formal ticket message or resolution instructions here..."
                                                rows={2}
                                                value={ticketReplyText}
                                                onChange={(e) => setTicketReplyText(e.target.value)}
                                                disabled={submittingTicketReply}
                                                className="text-xs resize-none rounded-xl font-medium"
                                                required
                                            />
                                            <div className="flex items-center justify-between border-t pt-2.5">
                                                <input type="file" ref={ticketFileInputRef} onChange={(e) => setSelectedTicketFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" multiple />
                                                <Button type="button" variant="outline" onClick={() => ticketFileInputRef.current?.click()} disabled={submittingTicketReply || isUploading} className="text-[10px] h-8 gap-1.5 font-bold">
                                                    <Paperclip className="w-3.5 h-3.5 text-violet-500" />
                                                    Add Files
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={submittingTicketReply || isUploading || (!ticketReplyText.trim() && selectedTicketFiles.length === 0)}
                                                    className="text-xs h-8 px-4 font-bold gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl shadow-md"
                                                >
                                                    {submittingTicketReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                    Send Response
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                {/* RIGHT: Ticket management sidebar */}
                                <div className="w-72 flex-none border-l flex flex-col overflow-hidden">
                                    <ScrollArea className="flex-1 p-4">
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ticket Management</h4>
                                                <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Admin-only controls and metrics.</p>
                                            </div>

                                            <div className="flex flex-col gap-1 p-3 rounded-xl border bg-card shadow-sm">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">Assigned Operations Agent</span>
                                                {selectedAdminTicket.assignedTo ? (
                                                    <span className="text-xs font-bold flex items-center gap-1.5 mt-1">
                                                        <Headset className="w-4 h-4 text-violet-500" />
                                                        {selectedAdminTicket.assignedTo.name}
                                                    </span>
                                                ) : (
                                                    <div className="space-y-2 mt-1.5">
                                                        <Badge variant="destructive" className="text-[9px] font-bold px-2 py-0.5 uppercase tracking-wide">
                                                            Unassigned
                                                        </Badge>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleAssignTicket(selectedAdminTicket._id)}
                                                            className="w-full text-[10px] font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl shadow-md"
                                                        >
                                                            Claim Assignment
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-1 p-3 rounded-xl border bg-card shadow-sm">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">Ticket Creator Details</span>
                                                <span className="text-xs font-bold flex items-center gap-1.5 mt-1 truncate">
                                                    <User className="w-4 h-4 text-violet-500" />
                                                    {selectedAdminTicket.clientId?.name || selectedAdminTicket.guestId?.name}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate font-semibold">
                                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                                    {selectedAdminTicket.clientId?.email || selectedAdminTicket.guestId?.email}
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1 p-3 rounded-xl border bg-card shadow-sm">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">Date Opened</span>
                                                <span className="text-xs font-bold flex items-center gap-1.5 mt-1">
                                                    <Calendar className="w-4 h-4 text-violet-500" />
                                                    {new Date(selectedAdminTicket.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
