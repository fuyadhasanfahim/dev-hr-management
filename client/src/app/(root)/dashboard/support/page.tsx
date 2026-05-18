'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSupportSocket } from '@/hooks/useSupportSocket';
import { useSupportStore } from '@/store/useSupportStore';
import { useS3Upload } from '@/hooks/useS3Upload';
import { useSession } from '@/lib/auth-client';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
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
            const qRes = await fetch('/api/support/chat/sessions/queued');
            const aRes = await fetch('/api/support/chat/sessions/active');
            
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
            const response = await fetch('/api/support/tickets/admin');
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
        joinChat(sessionItem.sessionId);
        setMessages([]); // reset list

        try {
            const response = await fetch(`/api/support/chat/sessions/${sessionItem.sessionId}/messages`);
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
            const response = await fetch(`/api/support/chat/sessions/${sessionId}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const response = await fetch(`/api/support/chat/sessions/${selectedSession.sessionId}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Failed to close session.');
            }

            toast.info('Chat session closed and archived.');
            setSelectedSession(null);
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
            const response = await fetch(`/api/support/chat/sessions/${selectedSession.sessionId}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Could not convert live chat session.');
            }

            const { data } = await response.json();
            toast.success(`Chat successfully converted to Ticket: ${data.ticketId}`);
            setSelectedSession(null);
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

        // Optimistically render
        addMessage({
            sessionId: selectedSession.sessionId,
            sender: session?.user?.id || 'staff',
            senderModel: 'User',
            senderName: session?.user?.name || 'Agent',
            content: chatInput,
            attachments,
            isInternal: isInternalNote,
            createdAt: new Date().toISOString(),
        });

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

            const response = await fetch(`/api/support/tickets/${selectedAdminTicket._id}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: ticketReplyText,
                    attachments,
                }),
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
            const response = await fetch(`/api/support/tickets/${ticketId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
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
            const response = await fetch(`/api/support/tickets/${ticketId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        <div className="flex-1 flex flex-col min-h-0 space-y-4 select-none">
            {/* CONSOLE NAVIGATION HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                        <Headset className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold tracking-tight">Support Operations Console</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Manage customer tickets, claim queues, and hold live agent discussions.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl border shrink-0">
                    <button
                        onClick={() => { setActiveTab('chats'); setSelectedAdminTicket(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'chats'
                                ? 'bg-background text-foreground shadow-sm font-bold border'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Live Chats ({queuedSessions.length + activeSessions.length})
                    </button>
                    <button
                        onClick={() => { setActiveTab('tickets'); setSelectedSession(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'tickets'
                                ? 'bg-background text-foreground shadow-sm font-bold border'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <ClipboardList className="w-4 h-4" />
                        Ticketing Hub ({adminTickets.filter(t => t.status !== 'closed').length})
                    </button>
                </div>
            </div>

            {/* TAB VIEW 1: LIVE CHATS CONSOLE */}
            {activeTab === 'chats' && (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
                    {/* PANEL A: QUEUES SIDEBAR */}
                    <div className="md:col-span-4 flex flex-col min-h-0 bg-background rounded-2xl border shadow-sm">
                        <div className="p-4 border-b shrink-0">
                            <h3 className="text-xs font-bold text-foreground">Active Connection Queues</h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Real-time claiming wait lines.</p>
                        </div>
                        
                        <ScrollArea className="flex-1 p-3 min-h-0">
                            <div className="space-y-4">
                                {/* QUEUED LIVE CHATS */}
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-wider px-1">Waiting Queue ({queuedSessions.length})</h4>
                                    {queuedSessions.length === 0 ? (
                                        <p className="text-[10px] text-muted-foreground px-1 py-1">No chats waiting in queue.</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {queuedSessions.map((sessionItem) => (
                                                <div
                                                    key={sessionItem._id}
                                                    className="p-3 rounded-xl border border-rose-500/10 bg-rose-500/5 hover:bg-rose-500/10 flex flex-col gap-2 transition-colors select-none"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400">UNCLAIMED QUEUE</span>
                                                        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(sessionItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0 pr-1">
                                                        <p className="text-xs font-bold text-foreground truncate">
                                                            {sessionItem.clientId?.name || sessionItem.guestId?.name || 'Guest User'}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground truncate">
                                                            {sessionItem.clientId?.email || sessionItem.guestId?.email || 'No Email'}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleClaimSession(sessionItem.sessionId)}
                                                        disabled={actionLoading}
                                                        className="w-full text-[10px] h-7 font-semibold bg-rose-500 hover:bg-rose-600 text-white cursor-pointer"
                                                    >
                                                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Claim Conversation'}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* CLAIMED LIVE CHATS */}
                                <div className="space-y-2 border-t pt-4">
                                    <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider px-1">Your Claimed Chats ({activeSessions.length})</h4>
                                    {activeSessions.length === 0 ? (
                                        <p className="text-[10px] text-muted-foreground px-1 py-1">You have no active claimed chats.</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {activeSessions.map((sessionItem) => {
                                                const isSelected = selectedSession?.sessionId === sessionItem.sessionId;
                                                return (
                                                    <div
                                                        key={sessionItem._id}
                                                        onClick={() => handleSelectSession(sessionItem)}
                                                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-primary/5 border-primary shadow-sm'
                                                                : 'border-border bg-card/65 hover:bg-card'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">ACTIVE CHAT</span>
                                                            <span className="text-[9px] text-muted-foreground">
                                                                {new Date(sessionItem.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-xs font-bold text-foreground truncate">
                                                            {sessionItem.clientId?.name || sessionItem.guestId?.name || 'Customer'}
                                                        </h4>
                                                        <p className="text-[10px] text-muted-foreground truncate">
                                                            {sessionItem.clientId?.email || sessionItem.guestId?.email}
                                                        </p>
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
                    <div className="md:col-span-8 flex flex-col min-h-0 bg-background rounded-2xl border shadow-sm overflow-hidden">
                        {!selectedSession ? (
                            <EmptySupportState
                                title="No Active Live Chat claimed"
                                description="Select an active chat session from your claimed list on the left to start real-time messaging, or claim an unclaimed session from the waiting queue."
                            />
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0 lg:grid lg:grid-cols-12">
                                {/* CENTER: MESSAGE STREAM */}
                                <div className="lg:col-span-8 flex flex-col min-h-0 border-r border-border/55">
                                    {/* Header Status */}
                                    <div className="px-5 py-3 border-b flex items-center justify-between shrink-0 bg-card/15">
                                        <div className="min-w-0 pr-1">
                                            <h4 className="text-xs font-bold text-foreground truncate">
                                                {selectedSession.clientId?.name || selectedSession.guestId?.name || 'Customer'}
                                            </h4>
                                            <p className="text-[10px] text-muted-foreground truncate">
                                                {selectedSession.clientId?.email || selectedSession.guestId?.email}
                                            </p>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-1.5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleConvertChatToTicket}
                                                disabled={actionLoading}
                                                className="text-[10px] h-7 gap-1 font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                                                title="Convert Chat to Ticket"
                                            >
                                                <Share2 className="w-3.5 h-3.5" />
                                                Convert to Ticket
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={handleCloseSession}
                                                disabled={actionLoading}
                                                className="text-[10px] h-7 gap-1 font-semibold cursor-pointer"
                                            >
                                                <CheckSquare className="w-3.5 h-3.5" />
                                                Close Chat
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Conversation thread */}
                                    <ScrollArea className="flex-1 p-4 min-h-0 bg-slate-50/20 dark:bg-slate-950/5">
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
                                                        <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
                                                            <span className={`text-[10px] font-bold ${isInternal ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {isSelf ? 'You' : msg.senderName}
                                                                {isInternal && ' (Internal Note)'}
                                                            </span>
                                                            <span className="text-[8px] text-muted-foreground">
                                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>

                                                        <div
                                                            className={`px-3.5 py-2 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                                                                isInternal
                                                                    ? 'bg-amber-500/10 dark:bg-amber-400/5 text-amber-900 dark:text-amber-400 rounded-2xl border border-amber-500/20'
                                                                    : isSelf
                                                                    ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                                    : 'bg-muted text-foreground rounded-tl-none border'
                                                            }`}
                                                        >
                                                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                                                            {msg.attachments && msg.attachments.length > 0 && (
                                                                <div className="space-y-1 mt-2 pt-1 border-t border-black/10">
                                                                    {msg.attachments.map((file: any, fIdx: number) => (
                                                                        <a
                                                                            key={fIdx}
                                                                            href={file.url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="flex items-center gap-1 text-[10px] hover:underline"
                                                                        >
                                                                            <Paperclip className="w-3 h-3 shrink-0" />
                                                                            <span className="truncate max-w-[150px]">{file.fileName}</span>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {isSelf && !isInternal && (
                                                            <div className="text-[8px] text-muted-foreground mt-0.5 mr-1">
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
                                                    <div key={userId} className="flex flex-col items-start">
                                                        <TypingIndicator label={`${user.name} is typing...`} />
                                                    </div>
                                                );
                                            })}
                                            <div ref={chatEndRef} />
                                        </div>
                                    </ScrollArea>

                                    {/* Console editor inputs */}
                                    <div className="p-3 border-t bg-background flex flex-col gap-2.5 shrink-0">
                                        {/* Upload S3 progress */}
                                        {isUploading && (
                                            <div className="p-2 border rounded-xl space-y-1 bg-card">
                                                <div className="flex justify-between text-[9px] text-muted-foreground">
                                                    <span>Uploading media directly to S3...</span>
                                                </div>
                                                {Object.entries(uploadProgress).map(([name, progress]) => (
                                                    <Progress key={name} value={progress} className="h-1" />
                                                ))}
                                            </div>
                                        )}

                                        {/* Uploaded selection list */}
                                        {selectedChatFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedChatFiles.map((file, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full text-[10px] border max-w-xs"
                                                    >
                                                        <span className="truncate">{file.name}</span>
                                                        <button onClick={() => setSelectedChatFiles(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 ml-1">
                                                            <Plus className="w-3 h-3 rotate-45" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Input Box Toolbar */}
                                        <form onSubmit={handleSendChatMessage} className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between border-b pb-2">
                                                <div className="flex items-center gap-1.5">
                                                <input type="file" ref={chatFileInputRef} onChange={(e) => setSelectedChatFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" multiple />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => chatFileInputRef.current?.click()}
                                                        disabled={isUploading}
                                                        className="text-[10px] h-7 gap-1 font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                                                    >
                                                        <Paperclip className="w-3.5 h-3.5" />
                                                        Add Files
                                                    </Button>
                                                </div>
                                                
                                                {/* INTERNAL NOTES SLIDER TOGGLE */}
                                                <button
                                                    type="button"
                                                    onClick={() => setIsInternalNote(!isInternalNote)}
                                                    className={`px-3 py-1 rounded-full text-[9px] font-bold border transition-colors cursor-pointer ${
                                                        isInternalNote
                                                            ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/65 hover:text-foreground'
                                                    }`}
                                                >
                                                    Internal Private Note
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Input
                                                    placeholder={isInternalNote ? 'Write a private internal note (visible only to agents)...' : 'Type public agent message...'}
                                                    value={chatInput}
                                                    onChange={(e) => { setChatInput(e.target.value); triggerTyping(); }}
                                                    className="h-8 text-xs flex-1 rounded-full px-3.5 bg-card/65 focus-visible:ring-primary focus-visible:ring-1"
                                                />
                                                <Button type="submit" size="icon" disabled={!chatInput.trim() && selectedChatFiles.length === 0} className="w-8 h-8 rounded-full shrink-0 cursor-pointer">
                                                    <Send className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                {/* RIGHT: CUSTOMER METADATA CARD */}
                                <div className="lg:col-span-4 p-4 space-y-5 bg-card/5 shrink-0 border-t lg:border-t-0 select-none">
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Customer Context</h4>
                                        <p className="text-[10px] text-muted-foreground">Detailed identity verification audit.</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[9px] text-muted-foreground">User Name</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1">
                                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                {selectedSession.clientId?.name || selectedSession.guestId?.name}
                                            </span>
                                        </div>
                                        
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[9px] text-muted-foreground">Email Profile</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1">
                                                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                                {selectedSession.clientId?.email || selectedSession.guestId?.email}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[9px] text-muted-foreground">Verification Class</span>
                                            <div>
                                                {selectedSession.clientId ? (
                                                    <span className="text-[8px] font-bold px-2 py-0.5 rounded-md border border-indigo-500/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                                                        REGISTERED CLIENT
                                                    </span>
                                                ) : (
                                                    <span className="text-[8px] font-bold px-2 py-0.5 rounded-md border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                                                        VERIFIED GUEST (OTP)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[9px] text-muted-foreground">Conversation Initiated</span>
                                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
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
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
                    {/* PANEL A: SEARCH & ALL TICKETS TABLE */}
                    <div className="md:col-span-4 flex flex-col min-h-0 bg-background rounded-2xl border shadow-sm">
                        <div className="p-4 border-b space-y-3 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by ID or subject..."
                                    value={ticketSearch}
                                    onChange={(e) => setTicketSearch(e.target.value)}
                                    className="pl-9 text-xs h-9 bg-card/65 focus-visible:ring-primary focus-visible:ring-1"
                                />
                            </div>
                        </div>

                        <ScrollArea className="flex-1 p-3 min-h-0">
                            {loadingTickets ? (
                                <div className="space-y-2.5">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="h-16 w-full rounded-xl bg-muted/65 animate-pulse border" />
                                    ))}
                                </div>
                            ) : filteredAdminTickets.length === 0 ? (
                                <p className="text-center py-12 text-xs text-muted-foreground">No tickets in system.</p>
                            ) : (
                                <div className="space-y-2 pr-1.5">
                                    {filteredAdminTickets.map((ticketItem) => (
                                        <div
                                            key={ticketItem._id}
                                            onClick={async () => {
                                                setSelectedAdminTicket(ticketItem);
                                                // Load detailed replies logs
                                                try {
                                                    const res = await fetch(`/api/support/tickets/${ticketItem._id}`);
                                                    if (res.ok) {
                                                        const data = await res.json();
                                                        setSelectedAdminTicket(data.data);
                                                    }
                                                } catch (e) {}
                                            }}
                                            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                                selectedAdminTicket?._id === ticketItem._id
                                                    ? 'bg-primary/5 border-primary shadow-sm'
                                                    : 'border-border bg-card/65 hover:bg-card'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[10px] font-bold text-muted-foreground">{ticketItem.ticketId}</span>
                                                <PriorityBadge priority={ticketItem.priority} />
                                            </div>
                                            <h4 className="text-xs font-bold text-foreground truncate pr-1">{ticketItem.subject}</h4>
                                            <div className="flex items-center justify-between mt-2">
                                                <StatusBadge status={ticketItem.status} />
                                                <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {new Date(ticketItem.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* PANEL B: SELECTED TICKET DETAILED PANEL */}
                    <div className="md:col-span-8 flex flex-col min-h-0 bg-background rounded-2xl border shadow-sm overflow-hidden">
                        {!selectedAdminTicket ? (
                            <EmptySupportState
                                title="No Ticket Selected"
                                description="Select a formal ticket from the search table on the left to claim agent assignments, respond directly, view attached PDF/screenshot media logs, and edit status progressions."
                            />
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0 lg:grid lg:grid-cols-12">
                                {/* CENTER: TICKET REPLIES timelines */}
                                <div className="lg:col-span-8 flex flex-col min-h-0 border-r border-border/55">
                                    {/* Header action panel */}
                                    <div className="px-5 py-3.5 border-b bg-card/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-muted-foreground">{selectedAdminTicket.ticketId}</span>
                                                <PriorityBadge priority={selectedAdminTicket.priority} />
                                            </div>
                                            <h4 className="text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-none">{selectedAdminTicket.subject}</h4>
                                        </div>

                                        {/* Status updates selectors */}
                                        <div className="flex items-center gap-1.5">
                                            <select
                                                value={selectedAdminTicket.status}
                                                onChange={(e) => handleUpdateTicketStatus(selectedAdminTicket._id, e.target.value)}
                                                className="text-[10px] font-semibold border rounded-lg p-1.5 bg-background border-border text-foreground hover:bg-muted/50 cursor-pointer"
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
                                    <ScrollArea className="flex-1 p-4 min-h-0 bg-slate-50/20 dark:bg-slate-950/5">
                                        <div className="space-y-4 pr-1.5">
                                            {/* Original submission card */}
                                            <div className="p-4 rounded-xl border border-dashed bg-primary/5 space-y-3">
                                                <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                                                    <span className="font-bold flex items-center gap-1.5 text-foreground">
                                                        <User className="w-3.5 h-3.5" />
                                                        {selectedAdminTicket.clientId?.name || selectedAdminTicket.guestId?.name} (Original Submission)
                                                    </span>
                                                    <span>{new Date(selectedAdminTicket.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                </div>
                                                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedAdminTicket.text}</p>
                                                
                                                {/* S3 original media */}
                                                {selectedAdminTicket.attachments && selectedAdminTicket.attachments.length > 0 && (
                                                    <div className="space-y-1.5 pt-2 border-t">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {selectedAdminTicket.attachments.map((file: any, idx: number) => (
                                                                <a
                                                                    key={idx}
                                                                    href={file.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex items-center gap-1.5 p-1 px-2.5 rounded-lg border text-[9px] bg-background hover:bg-muted truncate max-w-[180px]"
                                                                >
                                                                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
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
                                                        className={`p-4 rounded-xl border ${
                                                            isAgent ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-card border-border'
                                                        } space-y-2`}
                                                    >
                                                        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                                                            <span className={`font-bold flex items-center gap-1.5 ${isAgent ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>
                                                                {reply.senderId?.name || (isAgent ? 'Agent Admin' : 'Customer')}
                                                            </span>
                                                            <span>{new Date(reply.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                        </div>
                                                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{reply.text}</p>

                                                        {reply.attachments && reply.attachments.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t">
                                                                {reply.attachments.map((file: any, fIdx: number) => (
                                                                    <a
                                                                        key={fIdx}
                                                                        href={file.url}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="flex items-center gap-1.5 p-1 px-2.5 rounded-lg border text-[9px] bg-background hover:bg-muted truncate max-w-[180px]"
                                                                    >
                                                                        <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
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
                                    <div className="p-3 border-t bg-background flex flex-col gap-2 shrink-0">
                                        {isUploading && (
                                            <div className="p-2 border rounded-xl bg-card space-y-1">
                                                <div className="flex justify-between text-[9px] text-muted-foreground">
                                                    <span>Uploading media directly to S3...</span>
                                                </div>
                                                {Object.entries(uploadProgress).map(([name, progress]) => (
                                                    <Progress key={name} value={progress} className="h-1" />
                                                ))}
                                            </div>
                                        )}

                                        {selectedTicketFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedTicketFiles.map((file, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full text-[10px] border max-w-xs"
                                                    >
                                                        <span className="truncate">{file.name}</span>
                                                        <button onClick={() => setSelectedTicketFiles(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 ml-1">
                                                            <Plus className="w-3 h-3 rotate-45" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <form onSubmit={handleSendTicketReply} className="flex flex-col gap-2.5">
                                            <Textarea
                                                placeholder="Write formal ticket message or resolution instructions here..."
                                                rows={2}
                                                value={ticketReplyText}
                                                onChange={(e) => setTicketReplyText(e.target.value)}
                                                disabled={submittingTicketReply}
                                                className="text-xs resize-none bg-card/65 focus-visible:ring-primary focus-visible:ring-1"
                                                required
                                            />
                                            <div className="flex items-center justify-between">
                                                <input type="file" ref={ticketFileInputRef} onChange={(e) => setSelectedTicketFiles(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden" multiple />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => ticketFileInputRef.current?.click()}
                                                    disabled={submittingTicketReply || isUploading}
                                                    className="text-[10px] h-8 gap-1.5 font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                                                >
                                                    <Paperclip className="w-3.5 h-3.5" />
                                                    Add Files
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={submittingTicketReply || isUploading || (!ticketReplyText.trim() && selectedTicketFiles.length === 0)}
                                                    className="text-xs h-8 px-4 font-bold cursor-pointer gap-1.5"
                                                >
                                                    {submittingTicketReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                    Send Response
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                {/* RIGHT: TICKET ASSIGNMENT METRICS CARD */}
                                <div className="lg:col-span-4 p-4 space-y-5 bg-card/5 shrink-0 border-t lg:border-t-0 select-none">
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ticket Management</h4>
                                        <p className="text-[10px] text-muted-foreground">Admin-only controls and metrics.</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] text-muted-foreground">Assigned Operations Agent</span>
                                            {selectedAdminTicket.assignedTo ? (
                                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                    <Headset className="w-3.5 h-3.5 text-indigo-500" />
                                                    {selectedAdminTicket.assignedTo.name}
                                                </span>
                                            ) : (
                                                <div className="space-y-1.5 mt-1">
                                                    <span className="text-[10px] font-semibold text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded-md border border-rose-500/10">Unassigned</span>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleAssignTicket(selectedAdminTicket._id)}
                                                        className="w-full text-[10px] h-7 font-bold cursor-pointer"
                                                    >
                                                        Claim Assignment
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-0.5 border-t pt-3">
                                            <span className="text-[9px] text-muted-foreground">Ticket Creator Details</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                {selectedAdminTicket.clientId?.name || selectedAdminTicket.guestId?.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                                {selectedAdminTicket.clientId?.email || selectedAdminTicket.guestId?.email}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-0.5 border-t pt-3">
                                            <span className="text-[9px] text-muted-foreground">Date Opened</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
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
