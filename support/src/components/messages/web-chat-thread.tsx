'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { ArrowLeft, Globe, Loader2, Mail, Paperclip, Phone, Send, Ticket, UserCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CustomerAvatar } from '@/components/messages/customer-avatar';
import { AttachmentPreview } from '@/components/messages/chat-attachment';
import { useSupportAgent } from '@/hooks/use-support-agent';
import { baseApi } from '@/store/api/baseApi';
import {
    useClaimSessionMutation,
    useCloseSessionMutation,
    useGetWebInboxQuery,
    useRequestPresignedUrlMutation,
    type ChatMessage,
} from '@/store/api/chatApi';
import { connectSocket, getSocket, onSocketEvent } from '@/lib/socket';
import type { AppDispatch } from '@/store';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * One website live chat inside the Messages inbox: history and live messages over the support socket, reply,
 * attachments, take / end the chat, and the link to the ticket every live chat has.
 */
export function WebChatThread({ sessionId }: { sessionId: string }) {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const agent = useSupportAgent();
    const { data: inbox = [] } = useGetWebInboxQuery();
    const chat = inbox.find((c) => c.sessionId === sessionId) ?? null;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [joined, setJoined] = useState(false);
    const [typing, setTyping] = useState<string | null>(null);
    const [online, setOnline] = useState<boolean | null>(null);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [claimSession] = useClaimSessionMutation();
    const [closeSession] = useCloseSessionMutation();
    const [requestPresign] = useRequestPresignedUrlMutation();

    // The mongo id of this chat (messages carry it, the room is keyed by the uuid).
    const objectIdRef = useRef<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const markSeen = useCallback(() => {
        if (document.visibilityState !== 'visible') return;
        getSocket().emit('chat:seen', { sessionId });
        dispatch(baseApi.util.invalidateTags(['WebInbox']));
    }, [sessionId, dispatch]);

    // Join the room and follow it. Listeners go through onSocketEvent so a reconnect keeps them.
    useEffect(() => {
        // The parent mounts this with key={sessionId}, so every chat starts from clean state.
        objectIdRef.current = null;

        const join = () => getSocket().emit('chat:join', { sessionId });
        connectSocket();
        if (getSocket().connected) join();

        const offs = [
            onSocketEvent('connect', join),
            onSocketEvent('chat:joined', (payload: { session: { _id: string; sessionId: string }; messages: ChatMessage[] }) => {
                if (payload.session?.sessionId !== sessionId) return;
                objectIdRef.current = payload.session._id;
                setMessages(payload.messages ?? []);
                setJoined(true);
                markSeen();
            }),
            onSocketEvent('chat:message', (msg: ChatMessage) => {
                if (!objectIdRef.current || msg.sessionId !== objectIdRef.current) return;
                setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
                setTyping(null);
                if (msg.senderModel === 'Guest' || msg.senderModel === 'Client') markSeen();
                else dispatch(baseApi.util.invalidateTags(['WebInbox']));
            }),
            onSocketEvent('chat:typing', ({ userId, userName, isTyping }: { userId: string; userName: string; isTyping: boolean }) => {
                if (userId === agent.id) return;
                setTyping(isTyping ? userName : null);
            }),
            onSocketEvent('chat:visitor_presence', (p: { sessionId: string; online: boolean }) => {
                if (p.sessionId === sessionId) setOnline(p.online);
            }),
            onSocketEvent('chat:closed', () => dispatch(baseApi.util.invalidateTags(['WebInbox']))),
        ];
        const onVisible = () => markSeen();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            offs.forEach((off) => off());
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [sessionId, agent.id, markSeen, dispatch]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    const assignee = chat?.assignedAgent ?? null;
    const mine = !!assignee && assignee._id === agent.id;
    const lockedByOther = !!assignee && !mine && !agent.canManage;
    const ended = chat?.status === 'ended';

    const claim = async () => {
        if (!chat) return;
        try {
            await claimSession(chat.sessionId).unwrap();
            // Tells the visitor an agent joined and moves the chat for every other agent.
            getSocket().emit('chat:claim', { sessionId: chat.sessionId });
        } catch (err) {
            toast.error('Couldn’t take this chat', { description: (err as { data?: { message?: string } }).data?.message });
            throw err;
        }
    };

    const send = async (text: string, attachments: string[] = []) => {
        if ((!text && !attachments.length) || ended || lockedByOther) return;
        setBusy(true);
        try {
            if (!assignee) await claim();
            getSocket().emit('chat:message', { sessionId, text, attachments });
            getSocket().emit('chat:typing', { sessionId, isTyping: false });
        } catch {
            // claim failed: the toast says why
        } finally {
            setBusy(false);
        }
    };

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        const text = draft.trim();
        if (!text) return;
        setDraft('');
        void send(text);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };

    const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setDraft(e.target.value);
        if (!e.target.value) return;
        getSocket().emit('chat:typing', { sessionId, isTyping: true });
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => getSocket().emit('chat:typing', { sessionId, isTyping: false }), 1500);
    };

    const upload = async (files: File[]) => {
        if (!files.length) return;
        setUploading(true);
        const urls: string[] = [];
        for (const file of files) {
            if (file.size > MAX_UPLOAD_BYTES) {
                toast.error('File too large', { description: `${file.name} is over the 10 MB limit.` });
                continue;
            }
            try {
                const presigned = await requestPresign({
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    folder: 'chats',
                    referenceId: sessionId,
                }).unwrap();
                const put = await fetch(presigned.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
                if (!put.ok) throw new Error(`Upload failed (${put.status})`);
                urls.push(presigned.fileUrl);
            } catch (err) {
                toast.error(`Couldn’t upload ${file.name}`, { description: err instanceof Error ? err.message : undefined });
            }
        }
        setUploading(false);
        if (urls.length) await send('', urls);
    };

    const endChat = async () => {
        setConfirmEnd(false);
        try {
            await closeSession(sessionId).unwrap();
            toast.success('Chat ended');
        } catch (err) {
            toast.error('Couldn’t end the chat', { description: (err as { data?: { message?: string } }).data?.message });
        }
    };

    const name = chat?.visitor.name ?? 'Website visitor';
    const subtitle = useMemo(() => {
        if (ended) return 'Chat ended';
        if (typing) return `${typing} is typing…`;
        if (assignee) return mine ? 'Assigned to you' : `${assignee.name} is handling this chat`;
        return online === false ? 'Visitor stepped away · unassigned' : 'Unassigned';
    }, [ended, typing, assignee, mine, online]);

    return (
        <>
            <div className="flex items-center justify-between gap-2 pl-14 pr-2 md:px-4 h-16 shrink-0 border-b bg-sidebar">
                <div className="flex items-center gap-1 md:gap-3 min-w-0">
                    <Button variant="ghost" size="icon" className="size-9 shrink-0 md:hidden" aria-label="Back to chats" onClick={() => router.push('/messages')}>
                        <ArrowLeft className="size-5" />
                    </Button>
                    <div className="relative shrink-0">
                        <CustomerAvatar name={name} className="size-9" />
                        <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-sky-500 ring-2 ring-sidebar">
                            <Globe className="size-2.5 text-white" />
                        </span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {chat?.ticket && (
                        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs sm:px-3" title="Open this chat's ticket">
                            <Link href={`/tickets?ticket=${chat.ticket.id}`}>
                                <Ticket className="size-3.5" />
                                <span className="hidden sm:inline">{chat.ticket.ticketId}</span>
                            </Link>
                        </Button>
                    )}
                    {!mine && !ended && (assignee ? agent.canManage : true) && (
                        <Button size="sm" className="h-8 gap-1.5 px-2 text-xs sm:px-3" onClick={() => void claim().catch(() => {})} title="Assign this chat to yourself">
                            <UserCheck className="size-3.5" />
                            <span className="hidden sm:inline">{assignee ? 'Take over' : 'Assign to me'}</span>
                        </Button>
                    )}
                    {!ended && (
                        <Button variant="ghost" size="icon" className="size-8" aria-label="End chat" title="End this chat" onClick={() => setConfirmEnd(true)}>
                            <XCircle className="size-4" />
                        </Button>
                    )}
                </div>
            </div>

            {chat && (chat.visitor.email || chat.visitor.phone) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
                    {chat.visitor.email && (
                        <span className="inline-flex items-center gap-1.5">
                            <Mail className="size-3" />
                            {chat.visitor.email}
                        </span>
                    )}
                    {chat.visitor.phone && (
                        <span className="inline-flex items-center gap-1.5">
                            <Phone className="size-3" />
                            {chat.visitor.phone}
                            {chat.visitor.isWhatsapp && <span className="rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">WhatsApp</span>}
                        </span>
                    )}
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                {!joined ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Loader2 className="size-5 animate-spin" />
                    </div>
                ) : (
                    <div className="mx-auto flex max-w-3xl flex-col gap-1">
                        {messages.map((m, i) => {
                            if (m.senderModel === 'System') {
                                return (
                                    <p key={m._id} className="my-2 self-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                                        {m.content}
                                    </p>
                                );
                            }
                            const own = m.senderModel === 'Staff';
                            const prev = messages[i - 1];
                            const first = !prev || prev.senderModel !== m.senderModel || prev.sender !== m.sender;
                            return (
                                <div key={m._id} className={cn('flex flex-col', own ? 'items-end' : 'items-start', first && 'mt-3')}>
                                    {first && !own && <p className="mb-1 ml-1 text-[11px] font-medium text-muted-foreground">{m.senderName}</p>}
                                    {first && own && <p className="mb-1 mr-1 text-[11px] font-medium text-muted-foreground">{m.sender === agent.id ? 'You' : m.senderName}</p>}
                                    <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed', own ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md')}>
                                        {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                                        {m.attachments?.map((url, k) => (
                                            <AttachmentPreview key={k} url={url} />
                                        ))}
                                    </div>
                                    <p className="mt-0.5 px-1 text-[10px] tabular-nums text-muted-foreground">{format(new Date(m.createdAt), 'h:mm a')}</p>
                                </div>
                            );
                        })}
                        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.</p>}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            {ended ? (
                <p className="shrink-0 border-t px-4 py-3 text-center text-sm text-muted-foreground">This chat has ended.</p>
            ) : lockedByOther ? (
                <p className="shrink-0 border-t px-4 py-3 text-center text-sm text-muted-foreground">
                    {assignee?.name} is handling this chat. Only they (or someone who can manage support) can reply.
                </p>
            ) : (
                <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t bg-sidebar p-3">
                    <input ref={fileRef} type="file" multiple hidden onChange={(e) => { void upload(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
                    <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Attach a file" disabled={uploading || !joined} onClick={() => fileRef.current?.click()}>
                        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                    </Button>
                    <Textarea
                        rows={1}
                        value={draft}
                        onChange={onChange}
                        onKeyDown={onKeyDown}
                        placeholder={assignee ? 'Type a message' : 'Type a message — sending assigns this chat to you'}
                        className="min-h-10 max-h-36 overflow-y-auto py-2.5 leading-5"
                    />
                    <Button type="submit" size="icon" className="size-10 shrink-0 rounded-full" aria-label="Send" disabled={!draft.trim() || busy || !joined}>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </Button>
                </form>
            )}

            <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>End this chat?</AlertDialogTitle>
                        <AlertDialogDescription>The visitor is told it was resolved and can’t reply any more. The chat’s ticket is marked resolved too.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep chatting</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void endChat()}>End chat</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
