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
            const response = await fetch(publicApiUrl('/api/support/tickets/admin'), { credentials: 'include' });
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
            const response = await fetch(publicApiUrl(`/api/support/tickets/${ticketId}/status`), {
                method: 'POST',
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
        <div className="flex-1 flex flex-col h-[calc(100dvh-12rem)] min-h-0 overflow-hidden space-y-4 select-none" style={{ maxHeight: 'calc(100dvh - 12rem)' }}>
            {/* CONSOLE NAVIGATION HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-indigo-500/30 text-indigo-500 shadow-md shadow-violet-500/5 dark:shadow-none animate-pulse">
                        <Headset className="w-5.5 h-5.5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Support Operations Console</h1>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                            Manage customer tickets, claim queues, and hold live agent discussions.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md p-1 rounded-full border border-slate-200/50 dark:border-slate-800/50 shrink-0 shadow-inner">
                    <button
                        onClick={() => { setActiveTab('chats'); setSelectedAdminTicket(null); }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 cursor-pointer ${
                            activeTab === 'chats'
                                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold shadow-md shadow-indigo-600/15 scale-[1.02]'
                                : 'text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-slate-800/40'
                        }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Live Chats ({queuedSessions.length + activeSessions.length})
                    </button>
                    <button
                        onClick={() => { setActiveTab('tickets'); setSelectedSession(null); }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 cursor-pointer ${
                            activeTab === 'tickets'
                                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold shadow-md shadow-indigo-600/15 scale-[1.02]'
                                : 'text-muted-foreground hover:text-foreground hover:bg-slate-200/40 dark:hover:bg-slate-800/40'
                        }`}
                    >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Ticketing Hub ({adminTickets.filter(t => t.status !== 'closed').length})
                    </button>
                </div>
            </div>

            {/* TAB VIEW 1: LIVE CHATS CONSOLE */}
            {activeTab === 'chats' && (
                <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden">
                    {/* PANEL A: QUEUES SIDEBAR */}
                    <div className="w-80 flex flex-col min-h-0 bg-background rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm shrink-0">
                        <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0 bg-slate-50/40 dark:bg-slate-900/10 rounded-t-2xl">
                            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Active Connection Queues
                            </h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Real-time claiming wait lines.</p>
                        </div>
                        
                        <ScrollArea className="flex-1 p-3 min-h-0">
                            <div className="space-y-4">
                                {/* QUEUED LIVE CHATS */}
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-wider px-1 flex items-center gap-1">
                                        Waiting Queue
                                        <span className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-[9px] font-bold text-rose-500">
                                            {queuedSessions.length}
                                        </span>
                                    </h4>
                                    {queuedSessions.length === 0 ? (
                                        <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/[0.1] text-center">
                                            <p className="text-[10px] font-medium text-muted-foreground">No chats waiting in queue.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {queuedSessions.map((sessionItem) => (
                                                <div
                                                    key={sessionItem._id}
                                                    className="p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] hover:bg-rose-500/[0.07] flex flex-col gap-2.5 transition-all duration-300 select-none shadow-sm hover:shadow-rose-500/5 relative overflow-hidden group"
                                                >
                                                    {/* Pulse indicators and tag */}
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
                                                        className="w-full text-[10px] h-8.5 font-semibold bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 active:scale-[0.98] transition-all rounded-xl cursor-pointer"
                                                    >
                                                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Claim Conversation'}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* CLAIMED LIVE CHATS */}
                                <div className="space-y-2 border-t border-slate-200/60 dark:border-slate-800/60 pt-4">
                                    <h4 className="text-[10px] font-bold text-violet-500 uppercase tracking-wider px-1 flex items-center gap-1">
                                        Your Claimed Chats
                                        <span className="px-1.5 py-0.5 rounded-full bg-violet-500/10 text-[9px] font-bold text-violet-500">
                                            {activeSessions.length}
                                        </span>
                                    </h4>
                                    {activeSessions.length === 0 ? (
                                        <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/[0.1] text-center">
                                            <p className="text-[10px] font-medium text-muted-foreground">You have no active claimed chats.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {activeSessions.map((sessionItem) => {
                                                const isSelected = selectedSession?.sessionId === sessionItem.sessionId;
                                                const clientName = sessionItem.clientId?.name || sessionItem.guestId?.name || 'Customer';
                                                const clientEmail = sessionItem.clientId?.email || sessionItem.guestId?.email || 'No email';
                                                
                                                // Resolve last message
                                                const lastMsg = sessionItem.lastMessage;
                                                const hasAttachments = lastMsg?.attachments && lastMsg.attachments.length > 0;
                                                
                                                // Time string
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
                                                        className={`p-3 rounded-xl border flex gap-3 transition-all cursor-pointer select-none duration-300 ${
                                                            isSelected
                                                                ? 'bg-violet-600/[0.04] dark:bg-violet-600/[0.08] border-violet-500/30 border-l-[3.5px] border-l-violet-600 pl-2.5 shadow-sm'
                                                                : 'border-slate-200/50 dark:border-slate-800/50 bg-card/45 hover:bg-card hover:border-slate-300 dark:hover:border-slate-700'
                                                        }`}
                                                    >
                                                        {/* Avatar Column */}
                                                        <div className="shrink-0 flex items-center">
                                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold tracking-wider shadow-sm transition-all duration-300 ${
                                                                isSelected 
                                                                    ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white scale-105' 
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700/40'
                                                            }`}>
                                                                {initials || <User className="w-3.5 h-3.5" />}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Details Column */}
                                                        <div className="flex-1 min-w-0 flex flex-col justify-center leading-tight">
                                                            <div className="flex items-center justify-between gap-1.5">
                                                                <span className="text-xs font-bold text-foreground truncate max-w-[70%]">
                                                                    {clientName}
                                                                </span>
                                                                <span className="text-[9px] text-muted-foreground shrink-0 font-semibold">
                                                                    {timeStr}
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="text-[10px] text-muted-foreground truncate font-medium mt-0.5">
                                                                {clientEmail}
                                                            </div>

                                                            <div className="flex items-center gap-1 mt-1.5 min-w-0">
                                                                {hasAttachments && (
                                                                    <Paperclip className="w-3 h-3 text-violet-500 shrink-0" />
                                                                )}
                                                                <p className="text-[10px] text-muted-foreground/80 line-clamp-1 truncate w-full whitespace-nowrap">
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

                    {/* PANEL B: CHAT WINDOW & REPLY EDITOR */}
                    <div className="flex-1 flex flex-col min-h-0 bg-background rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden" style={{ minHeight: 0, maxHeight: '100%' }}>
                        {!selectedSession ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden bg-gradient-to-b from-transparent to-slate-50/30 dark:to-slate-900/10">
                                {/* Ambient radial glow */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-violet-500/5 blur-3xl -z-10 animate-pulse pointer-events-none" />
                                
                                <div className="max-w-md space-y-6 relative">
                                    <div className="relative inline-flex mx-auto">
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 blur-xl scale-125 animate-pulse" />
                                        <div className="relative p-6 rounded-full bg-gradient-to-tr from-violet-500/10 to-indigo-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 shadow-lg bg-card">
                                            <MessageSquare className="w-10 h-10 animate-bounce text-violet-500" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-bold text-foreground tracking-tight">No Active Live Chat Claimed</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto font-medium">
                                            Select a conversation from your claimed list on the left, or claim an incoming request from the waiting queue to begin real-time operations.
                                        </p>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-muted-foreground/80 font-medium">
                                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/40 dark:border-slate-700/40 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                            Live Socket Active
                                        </span>
                                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/40 dark:border-slate-700/40 flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            Claim-ready Queues
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-row min-h-0 overflow-hidden" style={{ minHeight: 0, maxHeight: '100%' }}>
                                {/* CENTER: MESSAGE STREAM */}
                                <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-r border-slate-200/50 dark:border-slate-800/50">
                                    {/* Header Status */}
                                    <div className="px-5 py-3.5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/20 backdrop-blur-sm">
                                        <div className="min-w-0 pr-1">
                                            <h4 className="text-sm font-bold text-foreground truncate">
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
                                                className="text-[10px] h-8 gap-1.5 font-bold text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-sm"
                                                title="Convert Chat to Ticket"
                                            >
                                                <Share2 className="w-3.5 h-3.5 text-violet-500" />
                                                Convert to Ticket
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={handleCloseSession}
                                                disabled={actionLoading}
                                                className="text-[10px] h-8 gap-1.5 font-bold cursor-pointer bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                                            >
                                                <CheckSquare className="w-3.5 h-3.5" />
                                                Close Chat
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Conversation thread */}
                                    <ScrollArea className="flex-1 min-h-0 overflow-hidden bg-slate-50/10 dark:bg-slate-950/5" style={{ minHeight: 0 }}>
                                        <div className="p-5">
                                            <div className="space-y-4 pr-1.5">
                                                {messages.map((msg, idx) => {
                                                    const isSelf = msg.sender === session?.user?.id;
                                                    const seen = msg.seenBy && msg.seenBy.length > 0;
                                                    const isInternal = msg.isInternal;

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`flex flex-col ${
                                                                isSelf ? 'items-end' : 'items-start'
                                                            }`}
                                                        >
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
                                                                <div
                                                                    className="bg-amber-500/[0.05] dark:bg-amber-500/[0.08] text-amber-900 dark:text-amber-200 border-l-4 border-l-amber-500 border-y border-r border-amber-500/20 px-4 py-3 rounded-2xl rounded-tr-none max-w-[85%] shadow-sm"
                                                                >
                                                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                                                                        <Lock className="w-3 h-3 shrink-0" />
                                                                        <span>Internal Private Note</span>
                                                                    </div>
                                                                    <p className="whitespace-pre-wrap break-words text-xs sm:text-sm font-medium leading-relaxed">{msg.content}</p>
                                                                    
                                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                                        <div className="space-y-1.5 mt-2.5 pt-2 border-t border-amber-500/10">
                                                                            {msg.attachments.map((file: any, fIdx: number) => (
                                                                                <a
                                                                                    key={fIdx}
                                                                                    href={file.url}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                                                                                >
                                                                                    <Paperclip className="w-3 h-3 shrink-0" />
                                                                                    <span className="truncate max-w-[200px]">{file.fileName}</span>
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed shadow-sm ${
                                                                        isSelf
                                                                            ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-none border border-violet-500/15'
                                                                            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200/80 dark:border-slate-800'
                                                                    }`}
                                                                >
                                                                    <p className="whitespace-pre-wrap break-words font-medium">{msg.content}</p>

                                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                                        <div className={`space-y-1 mt-2 pt-2 border-t ${
                                                                            isSelf ? 'border-white/10' : 'border-slate-200/50 dark:border-slate-800'
                                                                        }`}>
                                                                            {msg.attachments.map((file: any, fIdx: number) => (
                                                                                <a
                                                                                    key={fIdx}
                                                                                    href={file.url}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className={`flex items-center gap-1 text-[10px] font-semibold hover:underline ${
                                                                                        isSelf ? 'text-white/80' : 'text-violet-600 dark:text-violet-400'
                                                                                    }`}
                                                                                >
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

                                                {/* Typing indicators */}
                                                {Object.entries(typingUsers).map(([userId, user]) => {
                                                    if (userId === session?.user?.id || !user.isTyping) return null;
                                                    return (
                                                        <div key={userId} className="flex flex-col items-start px-1.5">
                                                            <TypingIndicator label={`${user.name} is typing...`} />
                                                        </div>
                                                    );
                                                })}
                                                <div ref={chatEndRef} />
                                            </div>
                                        </div>
                                    </ScrollArea>

                                    {/* Console editor inputs */}
                                    <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-900/10 flex flex-col gap-3 shrink-0">
                                        {/* Upload S3 progress */}
                                        {isUploading && (
                                            <div className="p-3 border border-slate-200/60 dark:border-slate-800/60 rounded-xl space-y-1.5 bg-card shadow-sm">
                                                <div className="flex justify-between text-[9px] font-bold text-muted-foreground tracking-wide uppercase">
                                                    <span>Uploading media directly to S3...</span>
                                                </div>
                                                {Object.entries(uploadProgress).map(([name, progress]) => (
                                                    <Progress key={name} value={progress} className="h-1 bg-slate-100 dark:bg-slate-800" />
                                                ))}
                                            </div>
                                        )}

                                        {/* Uploaded selection list */}
                                        {selectedChatFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedChatFiles.map((file, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1 rounded-full text-[10px] border border-slate-200/80 dark:border-slate-800 max-w-xs shadow-sm font-semibold text-foreground"
                                                    >
                                                        <span className="truncate">{file.name}</span>
                                                        <button onClick={() => setSelectedChatFiles(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-600 transition-colors ml-1">
                                                            <Plus className="w-3.5 h-3.5 rotate-45" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Input Box Toolbar */}
                                        <form onSubmit={handleSendChatMessage} className="flex flex-col gap-3 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3 shadow-sm shadow-slate-100 dark:shadow-none">
                                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <input type="file" ref={chatFileInputRef} onChange={(e) => setSelectedChatFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" multiple />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => chatFileInputRef.current?.click()}
                                                        disabled={isUploading}
                                                        className="text-[10px] h-7.5 gap-1.5 font-bold text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800/85 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer shadow-sm"
                                                    >
                                                        <Paperclip className="w-3.5 h-3.5 text-violet-500" />
                                                        Add Files
                                                    </Button>
                                                </div>
                                                
                                                {/* INTERNAL NOTES SLIDER TOGGLE */}
                                                <button
                                                    type="button"
                                                    onClick={() => setIsInternalNote(!isInternalNote)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all duration-300 cursor-pointer ${
                                                        isInternalNote
                                                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 shadow-sm shadow-amber-500/5 hover:bg-amber-500/15'
                                                            : 'bg-slate-55 dark:bg-slate-900 text-slate-500 border-slate-200/40 dark:border-slate-800 hover:bg-slate-100 hover:text-slate-700 dark:hover:text-slate-300'
                                                    }`}
                                                >
                                                    <Lock className="w-3.5 h-3.5" />
                                                    <span>{isInternalNote ? 'Secure Note Mode' : 'Internal Private Note'}</span>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isInternalNote ? 'bg-amber-500 animate-pulse' : 'bg-transparent'}`} />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-2.5">
                                                <div className="relative flex-1">
                                                    <Input
                                                        placeholder={isInternalNote ? 'Write a secure internal note (visible only to system operators)...' : 'Type public agent message...'}
                                                        value={chatInput}
                                                        onChange={(e) => { setChatInput(e.target.value); triggerTyping(); }}
                                                        className={`h-10 text-xs w-full rounded-xl px-4 py-2.5 transition-all duration-300 bg-white/80 dark:bg-slate-950/80 border focus:border-violet-500 focus:ring-violet-500/20 focus-visible:ring-violet-500/20 focus-visible:ring-1 ${
                                                            isInternalNote
                                                                ? 'border-amber-500/30 focus:border-amber-500 focus:ring-amber-500/20 focus-visible:ring-amber-500/20 focus-visible:ring-1'
                                                                : 'border-slate-200/80 dark:border-slate-800/80 focus:border-violet-500'
                                                        }`}
                                                    />
                                                </div>
                                                <Button 
                                                    type="submit" 
                                                    size="icon" 
                                                    disabled={!chatInput.trim() && selectedChatFiles.length === 0} 
                                                    className={`w-10 h-10 rounded-xl shrink-0 cursor-pointer shadow-md transition-all duration-300 hover:scale-105 active:scale-95 ${
                                                        isInternalNote
                                                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/10 hover:shadow-amber-500/25'
                                                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-indigo-600/10 hover:shadow-indigo-600/25'
                                                    }`}
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                {/* RIGHT: CUSTOMER METADATA CARD */}
                                <div className="hidden lg:block w-72 p-5 space-y-6 bg-slate-50/[0.15] dark:bg-slate-950/[0.15] shrink-0 select-none overflow-y-auto border-l border-slate-200/55 dark:border-slate-800/55">
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Customer Context</h4>
                                        <p className="text-[10px] text-muted-foreground font-semibold">Detailed identity verification audit.</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 shadow-sm">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">User Name</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                                                <User className="w-4 h-4 text-violet-500" />
                                                {selectedSession.clientId?.name || selectedSession.guestId?.name}
                                            </span>
                                        </div>
                                        
                                        <div className="flex flex-col gap-1 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 shadow-sm">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">Email Profile</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-0.5 truncate">
                                                <Mail className="w-4 h-4 text-violet-500" />
                                                {selectedSession.clientId?.email || selectedSession.guestId?.email}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 shadow-sm">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">Verification Class</span>
                                            <div className="mt-0.5">
                                                {selectedSession.clientId ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                                                        Authenticated User
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                        Unverified Guest
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 shadow-sm">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">Conversation Initiated</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                                                <Calendar className="w-4 h-4 text-violet-500" />
                                                {new Date(selectedSession.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB VIEW 2: TICKETING HUB */}
            {activeTab === 'tickets' && (
                <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden">
                    {/* PANEL A: SEARCH & ALL TICKETS TABLE */}
                    <div className="w-80 flex flex-col min-h-0 bg-background rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm shrink-0">
                        <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60 space-y-3 shrink-0 bg-slate-50/40 dark:bg-slate-900/10 rounded-t-2xl">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by ID or subject..."
                                    value={ticketSearch}
                                    onChange={(e) => setTicketSearch(e.target.value)}
                                    className="pl-9 text-xs h-9 bg-white/80 dark:bg-slate-950/80 border-slate-200/80 dark:border-slate-800/80 focus-visible:ring-violet-500/20 focus-visible:ring-1 rounded-xl"
                                />
                            </div>
                        </div>

                        <ScrollArea className="flex-1 p-3 min-h-0">
                            {loadingTickets ? (
                                <div className="space-y-3 pr-1.5">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="h-20 w-full rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 animate-pulse border border-slate-200/30 dark:border-slate-800/30" />
                                    ))}
                                </div>
                            ) : filteredAdminTickets.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                                    No tickets in system.
                                </div>
                            ) : (
                                <div className="space-y-2 pr-1.5">
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
                                                        : 'border-slate-200/50 dark:border-slate-800/50 bg-card/45 hover:bg-card'
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
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
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

                    {/* PANEL B: SELECTED TICKET DETAILED PANEL */}
                    <div className="flex-1 flex flex-col min-h-0 bg-background rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
                        {!selectedAdminTicket ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden bg-gradient-to-b from-transparent to-slate-50/30 dark:to-slate-900/10">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-violet-500/5 blur-3xl -z-10 animate-pulse pointer-events-none" />
                                
                                <div className="max-w-md space-y-6 relative">
                                    <div className="relative inline-flex mx-auto">
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 blur-xl scale-125 animate-pulse" />
                                        <div className="relative p-6 rounded-full bg-gradient-to-tr from-violet-500/10 to-indigo-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 shadow-lg bg-card">
                                            <ClipboardList className="w-10 h-10 animate-bounce text-violet-500" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-bold text-foreground tracking-tight">No Ticket Selected</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto font-medium">
                                            Select a formal ticket from the search table on the left to claim agent assignments, respond directly, view attached media, and edit status progressions.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
                                {/* CENTER: TICKET REPLIES timelines */}
                                <div className="flex-1 flex flex-col min-h-0 border-r border-slate-200/50 dark:border-slate-800/50">
                                    {/* Header action panel */}
                                    <div className="px-5 py-3.5 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-muted-foreground tracking-wider">{selectedAdminTicket.ticketId}</span>
                                                <PriorityBadge priority={selectedAdminTicket.priority} />
                                            </div>
                                            <h4 className="text-xs sm:text-sm font-bold text-foreground truncate max-w-[200px] sm:max-w-none">{selectedAdminTicket.subject}</h4>
                                        </div>

                                        {/* Status updates selectors */}
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={selectedAdminTicket.status}
                                                onChange={(e) => handleUpdateTicketStatus(selectedAdminTicket._id, e.target.value)}
                                                className="text-[10px] font-bold border border-slate-200/80 dark:border-slate-800 rounded-xl p-1.5 bg-white dark:bg-slate-950 text-foreground hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer shadow-sm transition-colors"
                                            >
                                                <option value="open">Open</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="pending_client">Pending Customer</option>
                                                <option value="resolved">Resolved</option>
                                                <option value="closed">Closed</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* timeline */}
                                    <ScrollArea className="flex-1 p-5 min-h-0 bg-slate-50/10 dark:bg-slate-950/5">
                                        <div className="space-y-5 pr-1.5">
                                            {/* Original submission card */}
                                            <div className="p-4 rounded-2xl border border-dashed border-violet-500/20 bg-violet-500/[0.02] dark:bg-violet-500/[0.04] space-y-3.5 shadow-sm">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                                                    <span className="flex items-center gap-1.5 text-foreground">
                                                        <User className="w-4 h-4 text-violet-500" />
                                                        {selectedAdminTicket.clientId?.name || selectedAdminTicket.guestId?.name} (Original Request)
                                                    </span>
                                                    <span>{new Date(selectedAdminTicket.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                </div>
                                                <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium">{selectedAdminTicket.text}</p>
                                                
                                                {/* S3 original media */}
                                                {selectedAdminTicket.attachments && selectedAdminTicket.attachments.length > 0 && (
                                                    <div className="space-y-1.5 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedAdminTicket.attachments.map((file: any, idx: number) => (
                                                                <a
                                                                    key={idx}
                                                                    href={file.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex items-center gap-1.5 p-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[10px] font-semibold bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 truncate max-w-[200px] shadow-sm transition-colors"
                                                                >
                                                                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                                                                    <span className="truncate">{file.fileName}</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Thread comments */}
                                            {selectedAdminTicket.replies && selectedAdminTicket.replies.map((reply: any, idx: number) => {
                                                const isAgent = reply.senderType === 'staff';
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`p-4.5 rounded-2xl border transition-all duration-300 shadow-sm ${
                                                            isAgent 
                                                                ? 'bg-violet-500/[0.03] dark:bg-violet-500/[0.06] border-violet-500/15 border-l-4 border-l-violet-600 pl-3.5' 
                                                                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80'
                                                        } space-y-2`}
                                                    >
                                                        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                                                            <span className={`flex items-center gap-1.5 ${isAgent ? 'text-violet-600 dark:text-violet-400 font-extrabold' : 'text-foreground font-bold'}`}>
                                                                {isAgent ? <Headset className="w-3.5 h-3.5 text-violet-500" /> : <User className="w-3.5 h-3.5 text-slate-400" />}
                                                                {reply.senderId?.name || (isAgent ? 'Agent Admin' : 'Customer')}
                                                            </span>
                                                            <span className="font-semibold">{new Date(reply.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                        </div>
                                                        <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium">{reply.text}</p>

                                                        {reply.attachments && reply.attachments.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
                                                                {reply.attachments.map((file: any, fIdx: number) => (
                                                                    <a
                                                                        key={fIdx}
                                                                        href={file.url}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="flex items-center gap-1.5 p-1.5 px-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[10px] font-semibold bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 truncate max-w-[200px] shadow-sm transition-colors"
                                                                    >
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

                                    {/* Ticket reply inputs toolbar */}
                                    <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-900/10 flex flex-col gap-3 shrink-0">
                                        {isUploading && (
                                            <div className="p-3 border border-slate-200/60 dark:border-slate-800/60 rounded-xl bg-card space-y-1.5 shadow-sm">
                                                <div className="flex justify-between text-[9px] font-bold text-muted-foreground tracking-wide uppercase">
                                                    <span>Uploading media directly to S3...</span>
                                                </div>
                                                {Object.entries(uploadProgress).map(([name, progress]) => (
                                                    <Progress key={name} value={progress} className="h-1 bg-slate-100 dark:bg-slate-800" />
                                                ))}
                                            </div>
                                        )}

                                        {selectedTicketFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedTicketFiles.map((file, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1 rounded-full text-[10px] border border-slate-200/80 dark:border-slate-800 max-w-xs shadow-sm font-semibold text-foreground"
                                                    >
                                                        <span className="truncate">{file.name}</span>
                                                        <button onClick={() => setSelectedTicketFiles(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-600 transition-colors ml-1">
                                                            <Plus className="w-3.5 h-3.5 rotate-45" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <form onSubmit={handleSendTicketReply} className="flex flex-col gap-3 bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3 shadow-sm shadow-slate-100 dark:shadow-none">
                                            <Textarea
                                                placeholder="Write formal ticket message or resolution instructions here..."
                                                rows={2}
                                                value={ticketReplyText}
                                                onChange={(e) => setTicketReplyText(e.target.value)}
                                                disabled={submittingTicketReply}
                                                className="text-xs resize-none w-full bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-800/60 focus:border-violet-500 focus:ring-violet-500/20 focus-visible:ring-violet-500/20 focus-visible:ring-1 rounded-xl p-3 font-medium transition-all"
                                                required
                                            />
                                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-900 pt-2.5">
                                                <input type="file" ref={ticketFileInputRef} onChange={(e) => setSelectedTicketFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" multiple />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => ticketFileInputRef.current?.click()}
                                                    disabled={submittingTicketReply || isUploading}
                                                    className="text-[10px] h-8 gap-1.5 font-bold text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer shadow-sm transition-colors"
                                                >
                                                    <Paperclip className="w-3.5 h-3.5 text-violet-500" />
                                                    Add Files
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={submittingTicketReply || isUploading || (!ticketReplyText.trim() && selectedTicketFiles.length === 0)}
                                                    className="text-xs h-8.5 px-4 font-bold cursor-pointer gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 active:scale-[0.98] transition-all"
                                                >
                                                    {submittingTicketReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                    Send Response
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                {/* RIGHT: TICKET ASSIGNMENT METRICS CARD */}
                                <div className="hidden lg:block w-72 p-5 space-y-6 bg-slate-50/[0.15] dark:bg-slate-950/[0.15] shrink-0 select-none overflow-y-auto border-l border-slate-200/55 dark:border-slate-800/55">
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ticket Management</h4>
                                        <p className="text-[10px] text-muted-foreground font-semibold">Admin-only controls and metrics.</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 shadow-sm">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">Assigned Operations Agent</span>
                                            {selectedAdminTicket.assignedTo ? (
                                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-1">
                                                    <Headset className="w-4 h-4 text-violet-500" />
                                                    {selectedAdminTicket.assignedTo.name}
                                                </span>
                                            ) : (
                                                <div className="space-y-2 mt-1.5">
                                                    <span className="inline-flex text-[9px] font-bold text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20 uppercase tracking-wide">
                                                        Unassigned
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleAssignTicket(selectedAdminTicket._id)}
                                                        className="w-full text-[10px] h-7.5 font-bold cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
                                                    >
                                                        Claim Assignment
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-1 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 shadow-sm mt-3">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">Ticket Creator Details</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-1 truncate">
                                                <User className="w-4 h-4 text-violet-500" />
                                                {selectedAdminTicket.clientId?.name || selectedAdminTicket.guestId?.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate font-semibold">
                                                <Mail className="w-4 h-4 text-slate-400" />
                                                {selectedAdminTicket.clientId?.email || selectedAdminTicket.guestId?.email}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-1 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 shadow-sm mt-3">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">Date Opened</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-1">
                                                <Calendar className="w-4 h-4 text-violet-500" />
                                                {new Date(selectedAdminTicket.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
