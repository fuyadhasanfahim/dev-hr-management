'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSupportStore } from '../../store/useSupportStore';
import { useS3Upload } from '../../hooks/useS3Upload';
import { useSession } from '@/lib/auth-client';
import {
    PlusCircle,
    Search,
    MessageSquare,
    Clock,
    User,
    Paperclip,
    Send,
    Loader2,
    Calendar,
    ArrowRight,
    Headset,
    ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { CreateTicketDialog } from '../../components/support/create-dialog';
import {
    PriorityBadge,
    StatusBadge,
    AttachmentPreview,
    EmptySupportState,
    formatBytes,
} from '../../components/support/support-elements';

export default function SupportPage() {
    const { data: session } = useSession();
    const { token, resetSupport } = useSupportStore();
    const { isUploading, uploadProgress, uploadFile } = useS3Upload();

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);

    // Tickets data states
    const [tickets, setTickets] = useState<any[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [loadingTickets, setLoadingTickets] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Filters states
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Conversation editor states
    const [replyText, setReplyText] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const threadEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll replies thread
    useEffect(() => {
        if (threadEndRef.current) {
            threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [selectedTicket?.replies]);

    // Fetch tickets list
    const fetchTickets = useCallback(async () => {
        setLoadingTickets(true);
        try {
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch('/api/support/tickets', {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                throw new Error('Failed to load tickets.');
            }

            const { data } = await response.json();
            setTickets(data);
        } catch (err) {
            // Safe bypass
        } finally {
            setLoadingTickets(false);
        }
    }, [token]);

    // Fetch single ticket details
    const fetchTicketDetails = async (ticketId: string) => {
        setLoadingDetails(true);
        try {
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`/api/support/tickets/${ticketId}`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                throw new Error('Failed to fetch details.');
            }

            const { data } = await response.json();
            setSelectedTicket(data);
        } catch (err) {
            toast.error('Failed to load ticket conversation.');
        } finally {
            setLoadingDetails(false);
        }
    };

    // Initial load hook
    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    // File attachments select
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
    };

    const handleRemoveSelectedFile = (idx: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    // Submit Reply message
    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() && selectedFiles.length === 0) return;
        if (!selectedTicket) return;

        setIsSubmittingReply(true);
        let uploadedAttachments: any[] = [];

        try {
            // Upload files directly to S3 sequentially
            for (const file of selectedFiles) {
                setUploadingFiles((prev) => [...prev, file.name]);
                const result = await uploadFile(file, selectedTicket._id);
                uploadedAttachments.push(result);
                setUploadingFiles((prev) => prev.filter((name) => name !== file.name));
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`/api/support/tickets/${selectedTicket._id}/reply`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    text: replyText,
                    attachments: uploadedAttachments,
                }),
            });

            if (!response.ok) {
                throw new Error('Could not submit reply.');
            }

            const { data } = await response.json();
            
            // Update conversation UI optimistically
            setSelectedTicket((prev: any) => ({
                ...prev,
                replies: [...(prev.replies || []), data],
            }));

            setReplyText('');
            setSelectedFiles([]);
            toast.success('Reply submitted successfully!');
        } catch (err: any) {
            toast.error(err.message || 'Failed to submit reply.');
            setUploadingFiles([]);
        } finally {
            setIsSubmittingReply(false);
        }
    };

    // Filter tickets array
    const filteredTickets = tickets.filter((ticket) => {
        const matchesQuery =
            ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.ticketId.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
        return matchesQuery && matchesStatus;
    });

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-6 select-none">
            {/* HERO INTRODUCTION BANNER */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-white/5 relative overflow-hidden shrink-0">
                <div className="absolute -right-10 -bottom-10 opacity-10">
                    <Headset className="w-48 h-48" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                    <div className="space-y-1.5">
                        <h1 className="text-xl font-bold tracking-tight">How can we support you?</h1>
                        <p className="text-xs text-slate-300 max-w-lg">
                            Submit a formal ticket to route directly to department supervisors, or initiate a live chat session using the speech bubble launcher in the bottom right corner.
                        </p>
                    </div>
                    <Button
                        onClick={() => setDialogOpen(true)}
                        className="bg-white hover:bg-white/95 text-slate-900 border-none shrink-0 self-start sm:self-center text-xs cursor-pointer font-bold gap-1.5 shadow-lg"
                    >
                        <PlusCircle className="w-4 h-4 text-slate-900" />
                        Create Support Ticket
                    </Button>
                </div>
            </div>

            {/* THREE PANEL TILES LAYOUT */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
                {/* PANEL A: SEARCH & TICKETS SIDEBAR */}
                <div className="md:col-span-4 flex flex-col min-h-0 bg-background rounded-2xl border shadow-md">
                    {/* Filters Toolbar */}
                    <div className="p-4 border-b space-y-3 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by ID or title..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 text-xs h-9 bg-card/65 focus-visible:ring-primary focus-visible:ring-1"
                            />
                        </div>
                        <div className="flex gap-1.5">
                            {['all', 'open', 'in_progress', 'resolved'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all cursor-pointer capitalize ${
                                        statusFilter === status
                                            ? 'bg-primary text-primary-foreground border-primary font-bold shadow-sm'
                                            : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                    }`}
                                >
                                    {status === 'in_progress' ? 'In Progress' : status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scrollable list */}
                    <ScrollArea className="flex-1 p-3 min-h-0">
                        {loadingTickets ? (
                            <div className="space-y-2.5 p-1">
                                {[...Array(3)].map((_, idx) => (
                                    <div key={idx} className="h-16 w-full rounded-xl bg-muted/65 animate-pulse border" />
                                ))}
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-xs">
                                No matching support tickets found.
                            </div>
                        ) : (
                            <div className="space-y-2 pr-1.5">
                                {filteredTickets.map((ticket) => (
                                    <div
                                        key={ticket._id}
                                        onClick={() => fetchTicketDetails(ticket._id)}
                                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                            selectedTicket?._id === ticket._id
                                                ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/10'
                                                : 'border-border bg-card/65 hover:bg-card hover:border-slate-300 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[10px] font-bold text-muted-foreground">{ticket.ticketId}</span>
                                            <PriorityBadge priority={ticket.priority} />
                                        </div>
                                        <h4 className="text-xs font-bold text-foreground line-clamp-1 mb-2 pr-1">{ticket.subject}</h4>
                                        <div className="flex items-center justify-between">
                                            <StatusBadge status={ticket.status} />
                                            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(ticket.createdAt).toLocaleDateString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* PANEL B & C: SELECTED TICKET DETAIL & REPLY TIMELINE */}
                <div className="md:col-span-8 flex flex-col min-h-0 bg-background rounded-2xl border shadow-md overflow-hidden">
                    {loadingDetails ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-2">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground">Loading ticket conversation history...</p>
                        </div>
                    ) : !selectedTicket ? (
                        <EmptySupportState
                            title="No Ticket Selected"
                            description="Select a support ticket from the list on the left to inspect its detailed conversation, view S3 file attachments, and reply directly to department supervisors."
                        />
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* DETAILED TICKET HEADER */}
                            <div className="px-5 py-4 border-b bg-card/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-muted-foreground">{selectedTicket.ticketId}</span>
                                        <PriorityBadge priority={selectedTicket.priority} />
                                    </div>
                                    <h2 className="text-sm font-bold text-foreground pr-2">{selectedTicket.subject}</h2>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    <StatusBadge status={selectedTicket.status} />
                                </div>
                            </div>

                            {/* TICKET DETAILS BODY SCREEN */}
                            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
                                {/* CENTER: REPLIES THREAD */}
                                <div className="lg:col-span-8 flex flex-col min-h-0 border-r border-border/55">
                                    <ScrollArea className="flex-1 p-4 min-h-0 bg-slate-50/20 dark:bg-slate-950/5">
                                        <div className="space-y-5 pr-2">
                                            {/* Original Creator Message */}
                                            <div className="p-4 rounded-xl border border-dashed bg-primary/5 space-y-3">
                                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                    <span className="font-bold flex items-center gap-1 text-foreground">
                                                        <User className="w-3.5 h-3.5" />
                                                        {selectedTicket.clientId?.name || selectedTicket.guestId?.name || 'Customer'} (Original Ticket)
                                                    </span>
                                                    <span>
                                                        {new Date(selectedTicket.createdAt).toLocaleString([], {
                                                            dateStyle: 'short',
                                                            timeStyle: 'short',
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{selectedTicket.text}</p>
                                                
                                                {/* S3 Original attachments */}
                                                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                                                    <div className="space-y-1.5 pt-2 border-t">
                                                        <p className="text-[10px] font-bold text-muted-foreground mb-1">Attached S3 Files:</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedTicket.attachments.map((file: any, idx: number) => (
                                                                <a
                                                                    key={idx}
                                                                    href={file.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex items-center gap-1.5 p-1 px-2.5 rounded-lg border text-[10px] bg-background hover:bg-muted truncate max-w-[200px]"
                                                                >
                                                                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                                                    <span className="truncate">{file.fileName}</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Discussion Logs Thread */}
                                            {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                                                <div className="space-y-4">
                                                    {selectedTicket.replies.map((reply: any, idx: number) => {
                                                        const isAgent = reply.senderType === 'staff';
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`p-4 rounded-xl border ${
                                                                    isAgent
                                                                        ? 'bg-indigo-500/5 border-indigo-500/10'
                                                                        : 'bg-card border-border'
                                                                } space-y-2.5`}
                                                            >
                                                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                                    <span className={`font-bold flex items-center gap-1 ${isAgent ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>
                                                                        {isAgent ? (
                                                                            <Headset className="w-3.5 h-3.5 text-indigo-500" />
                                                                        ) : (
                                                                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                                        )}
                                                                        {reply.senderId?.name || (isAgent ? 'Support Operations' : 'Customer')}
                                                                    </span>
                                                                    <span>
                                                                        {new Date(reply.createdAt).toLocaleString([], {
                                                                            dateStyle: 'short',
                                                                            timeStyle: 'short',
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{reply.text}</p>
                                                                
                                                                {/* S3 Reply attachments */}
                                                                {reply.attachments && reply.attachments.length > 0 && (
                                                                    <div className="space-y-1.5 pt-2 border-t">
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {reply.attachments.map((file: any, fIdx: number) => (
                                                                                <a
                                                                                    key={fIdx}
                                                                                    href={file.url}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="flex items-center gap-1.5 p-1 px-2.5 rounded-lg border text-[10px] bg-background hover:bg-muted truncate max-w-[200px]"
                                                                                >
                                                                                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                                                                    <span className="truncate">{file.fileName}</span>
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div ref={threadEndRef} />
                                        </div>
                                    </ScrollArea>

                                    {/* BOTTOM EDITOR FORM */}
                                    <div className="p-4 border-t bg-background/50 flex flex-col gap-3 shrink-0">
                                        {/* Uploading progress bars */}
                                        {isUploading && (
                                            <div className="p-3 border rounded-xl bg-card space-y-1.5">
                                                <div className="flex items-center gap-1 text-[10px] text-foreground font-semibold">
                                                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                                    <span>Uploading media directly to S3...</span>
                                                </div>
                                                {Object.entries(uploadProgress).map(([name, progress]) => (
                                                    <Progress key={name} value={progress} className="h-1" />
                                                ))}
                                            </div>
                                        )}

                                        {/* Selected Attachments list */}
                                        {selectedFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {selectedFiles.map((file, idx) => (
                                                    <AttachmentPreview
                                                        key={idx}
                                                        file={{
                                                            url: '',
                                                            fileName: file.name,
                                                            fileType: file.type,
                                                            fileSize: file.size,
                                                        }}
                                                        onDelete={() => handleRemoveSelectedFile(idx)}
                                                        className="h-9 py-1 text-[10px] w-auto max-w-sm"
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* Toolbar input */}
                                        <form onSubmit={handleSendReply} className="flex flex-col gap-2">
                                            <Textarea
                                                placeholder="Write your response here..."
                                                rows={2}
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                disabled={isSubmittingReply}
                                                className="text-xs resize-none bg-card/65 focus-visible:ring-primary focus-visible:ring-1"
                                                required
                                            />
                                            <div className="flex items-center justify-between">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileSelect}
                                                    className="hidden"
                                                    multiple
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={isSubmittingReply || isUploading}
                                                    className="text-xs cursor-pointer gap-1.5 h-8 font-semibold text-muted-foreground hover:text-foreground"
                                                >
                                                    <Paperclip className="w-3.5 h-3.5" />
                                                    Add S3 Files
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={isSubmittingReply || isUploading || (!replyText.trim() && selectedFiles.length === 0)}
                                                    className="text-xs cursor-pointer gap-1.5 h-8 font-bold"
                                                >
                                                    {isSubmittingReply ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            Sending...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send className="w-3.5 h-3.5" />
                                                            Send Reply
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>

                                {/* RIGHT: SIDEBAR DETAILS */}
                                <div className="lg:col-span-4 p-4 space-y-5 bg-card/5 select-none shrink-0 border-t lg:border-t-0">
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ticket Metadata</h4>
                                        <p className="text-[10px] text-muted-foreground">Detailed audit trail metrics.</p>
                                    </div>

                                    {/* Meta Items Grid */}
                                    <div className="space-y-3.5">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] text-muted-foreground">Assigned Agent</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1">
                                                <Headset className="w-3.5 h-3.5 text-indigo-500" />
                                                {selectedTicket.assignedTo?.name || 'Unassigned (Supervising)'}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] text-muted-foreground">Opened On</span>
                                            <span className="text-xs font-bold text-foreground flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                                {new Date(selectedTicket.createdAt).toLocaleDateString([], {
                                                    dateStyle: 'medium',
                                                })}
                                            </span>
                                        </div>

                                        {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] text-muted-foreground">System Tags</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {selectedTicket.tags.map((tag: string) => (
                                                        <span
                                                            key={tag}
                                                            className="text-[8px] font-bold px-2 py-0.5 rounded-md border bg-muted text-muted-foreground uppercase tracking-wide"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Box */}
                                    <div className="pt-4 border-t border-border/55">
                                        <div className="bg-amber-500/10 dark:bg-amber-400/5 text-amber-600 dark:text-amber-400 text-[10px] p-3 rounded-xl border border-amber-500/15 leading-relaxed flex gap-2">
                                            <ShieldAlert className="w-5 h-5 shrink-0" />
                                            <span>
                                                Tickets are monitored and audited for quality assurance. To request live chats, use the floating support widget launcher.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* CREATOR DIALOG DIAL MODAL */}
            <CreateTicketDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSuccess={fetchTickets}
            />
        </div>
    );
}
