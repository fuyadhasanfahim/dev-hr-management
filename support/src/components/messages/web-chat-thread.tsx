'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ChevronDown, Globe, Info, Loader2, Lock, MessageCircle, Send, Smile, Ticket, UserCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { EmojiPicker, EmojiPickerContent, EmojiPickerFooter, EmojiPickerSearch } from '@/components/ui/emoji-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { AttachMenu, AttachmentTray, releasePending, toPending, type PendingAttachment } from '@/components/messages/composer-attachments';
import { AttachmentPreview } from '@/components/messages/chat-attachment';
import { CustomerAvatar } from '@/components/messages/customer-avatar';
import { GROUP_WINDOW_MS, bubbleCorners, bubbleSpring, dateLabel, formatTime } from '@/components/messages/thread-utils';
import { useIsMobile } from '@/hooks/use-mobile';
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

interface Run {
    key: string;
    messages: ChatMessage[];
}
interface Day {
    label: string;
    runs: Run[];
}

// Same grouping as the WhatsApp thread: day pills, then runs of one sender within a few minutes.
function buildDays(messages: ChatMessage[]): Day[] {
    const days: Day[] = [];
    for (const m of messages) {
        const label = dateLabel(m.createdAt);
        let day = days[days.length - 1];
        if (!day || day.label !== label) {
            day = { label, runs: [] };
            days.push(day);
        }
        const run = day.runs[day.runs.length - 1];
        const prev = run?.messages[run.messages.length - 1];
        const joins =
            run &&
            prev &&
            m.senderModel !== 'System' &&
            prev.senderModel !== 'System' &&
            prev.senderModel === m.senderModel &&
            prev.sender === m.sender &&
            new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;
        if (joins) run.messages.push(m);
        else day.runs.push({ key: m._id, messages: [m] });
    }
    return days;
}

/**
 * One website live chat in the Messages inbox, laid out like the WhatsApp thread: history and live messages come over
 * the support socket, the agent joins before replying, and the chat can be moved to WhatsApp.
 */
export function WebChatThread({
    sessionId,
    infoOpen,
    onToggleInfo,
    onOpenWhatsApp,
}: {
    sessionId: string;
    infoOpen: boolean;
    onToggleInfo: () => void;
    onOpenWhatsApp: () => void;
}) {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const agent = useSupportAgent();
    const isMobile = useIsMobile();
    const { data: inbox = [], isLoading: inboxLoading } = useGetWebInboxQuery();
    const chat = inbox.find((c) => c.sessionId === sessionId) ?? null;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [joined, setJoined] = useState(false);
    const [typing, setTyping] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [pending, setPending] = useState<PendingAttachment[]>([]);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [joining, setJoining] = useState(false);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [claimSession] = useClaimSessionMutation();
    const [closeSession] = useCloseSessionMutation();
    const [requestPresign] = useRequestPresignedUrlMutation();

    // The mongo id of this chat (messages carry it, the room is keyed by the uuid).
    const objectIdRef = useRef<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [openedWith, setOpenedWith] = useState<Set<string>>(new Set());
    const [away, setAway] = useState(false);

    const markSeen = useCallback(() => {
        if (document.visibilityState !== 'visible') return;
        getSocket().emit('chat:seen', { sessionId });
        dispatch(baseApi.util.invalidateTags(['WebInbox']));
    }, [sessionId, dispatch]);

    // Join the room and follow it. Listeners go through onSocketEvent so a reconnect keeps them. The parent mounts
    // this with key={sessionId}, so every chat starts from clean state.
    useEffect(() => {
        objectIdRef.current = null;
        const join = () => getSocket().emit('chat:join', { sessionId });
        connectSocket();
        if (getSocket().connected) join();

        const offs = [
            onSocketEvent('connect', join),
            onSocketEvent('chat:joined', (payload: { session: { _id: string; sessionId: string }; messages: ChatMessage[] }) => {
                if (payload.session?.sessionId !== sessionId) return;
                objectIdRef.current = payload.session._id;
                setOpenedWith(new Set((payload.messages ?? []).map((m) => m._id)));
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
                if (p.sessionId === sessionId) setAway(!p.online);
            }),
            onSocketEvent('chat:closed', () => dispatch(baseApi.util.invalidateTags(['WebInbox']))),
            onSocketEvent('chat:handoff', () => dispatch(baseApi.util.invalidateTags(['WebInbox']))),
        ];
        const onVisible = () => markSeen();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            offs.forEach((off) => off());
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [sessionId, agent.id, markSeen, dispatch]);

    // Stick-to-bottom, like the WhatsApp thread: pinned while at the bottom, released when the agent scrolls up.
    const [leftBottom, setLeftBottom] = useState(false);
    useLayoutEffect(() => {
        const content = contentRef.current;
        const v = content?.closest<HTMLElement>('[data-slot=scroll-area-viewport]');
        if (!content || !v) return;
        v.scrollTop = v.scrollHeight;
        const onScroll = () => {
            const atBottom = v.scrollHeight - v.scrollTop - v.clientHeight < 80;
            stickToBottom.current = atBottom;
            setLeftBottom(!atBottom);
        };
        const resize = new ResizeObserver(() => {
            if (stickToBottom.current) v.scrollTop = v.scrollHeight;
        });
        v.addEventListener('scroll', onScroll, { passive: true });
        resize.observe(content);
        return () => {
            v.removeEventListener('scroll', onScroll);
            resize.disconnect();
        };
    }, [joined]);

    const assignee = chat?.assignedAgent ?? null;
    const mine = !!assignee && assignee._id === agent.id;
    const lockedByOther = !!assignee && !mine;
    const ended = chat?.status === 'ended';
    const onWhatsApp = !!chat?.whatsappConversationId;
    const days = useMemo(() => buildDays(messages), [messages]);

    const join = async () => {
        if (!chat) return;
        setJoining(true);
        try {
            await claimSession(chat.sessionId).unwrap();
            toast.success('You joined this chat');
            setTimeout(() => inputRef.current?.focus(), 50);
        } catch (err) {
            toast.error('Couldn’t join this chat', { description: (err as { data?: { message?: string } }).data?.message });
        } finally {
            setJoining(false);
        }
    };

    const upload = async (file: File): Promise<string | null> => {
        if (file.size > MAX_UPLOAD_BYTES) {
            toast.error('File too large', { description: `${file.name} is over the 10 MB limit.` });
            return null;
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
            return presigned.fileUrl;
        } catch (err) {
            toast.error(`Couldn’t upload ${file.name}`, { description: err instanceof Error ? err.message : undefined });
            return null;
        }
    };

    const send = async (e?: FormEvent) => {
        e?.preventDefault();
        const text = draft.trim();
        if ((!text && !pending.length) || sending || !mine) return;
        setSending(true);
        const files = pending;
        setDraft('');
        setPending([]);
        stickToBottom.current = true;
        try {
            const urls: string[] = [];
            for (const p of files) {
                const url = await upload(p.file);
                if (url) urls.push(url);
            }
            releasePending(files);
            if (text || urls.length) getSocket().emit('chat:message', { sessionId, text, attachments: urls });
            getSocket().emit('chat:typing', { sessionId, isTyping: false });
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send();
        }
    };

    const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setDraft(e.target.value);
        if (!e.target.value) return;
        getSocket().emit('chat:typing', { sessionId, isTyping: true });
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => getSocket().emit('chat:typing', { sessionId, isTyping: false }), 1500);
    };

    const addAttachments = (files: File[]) => {
        setPending((prev) => [...prev, ...toPending(files)]);
        inputRef.current?.focus();
    };
    const removeAttachment = (id: string) =>
        setPending((prev) => {
            releasePending(prev.filter((p) => p.id === id));
            return prev.filter((p) => p.id !== id);
        });
    const insertEmoji = (emoji: string) => {
        const input = inputRef.current;
        const start = input?.selectionStart ?? draft.length;
        const end = input?.selectionEnd ?? draft.length;
        setDraft(draft.slice(0, start) + emoji + draft.slice(end));
        requestAnimationFrame(() => {
            input?.focus();
            input?.setSelectionRange(start + emoji.length, start + emoji.length);
        });
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
    const subtitle = ended
        ? 'Chat ended'
        : typing
          ? `${typing} is typing…`
          : onWhatsApp
            ? 'Continues on WhatsApp'
            : assignee
              ? mine
                  ? 'Assigned to you'
                  : `${assignee.name} is handling this chat`
              : away
                ? 'Visitor stepped away · unassigned'
                : 'Website chat · unassigned';

    if (!chat && !inboxLoading) {
        return <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">This chat is no longer available.</p>;
    }

    return (
        <>
            <div className="flex items-center justify-between gap-2 pl-14 pr-2 md:px-4 h-16 shrink-0 border-b bg-sidebar">
                <div className="flex items-center gap-1 md:gap-3 min-w-0">
                    <Button variant="ghost" size="icon" className="size-9 shrink-0 md:hidden" aria-label="Back to chats" onClick={() => router.push('/messages')}>
                        <ArrowLeft className="size-5" />
                    </Button>
                    <button type="button" onClick={onToggleInfo} className="flex min-w-0 items-center gap-3 rounded-lg text-left" aria-label="Open contact info">
                        <div className="relative shrink-0">
                            <CustomerAvatar name={name} seed={chat?.visitor.email ?? sessionId} className="size-9" />
                            <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-sky-500 ring-2 ring-sidebar">
                                <Globe className="size-2.5 text-white" />
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                        </div>
                    </button>
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
                    {chat && !onWhatsApp && !ended && (
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs sm:px-3" disabled={!chat.visitor.phone} onClick={onOpenWhatsApp} title={chat.visitor.phone ? 'Continue this chat on WhatsApp' : 'No phone number'}>
                            <MessageCircle className="size-3.5 text-emerald-600" />
                            <span className="hidden sm:inline">Open in WhatsApp</span>
                        </Button>
                    )}
                    {onWhatsApp && chat?.whatsappConversationId && (
                        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs sm:px-3">
                            <Link href={`/messages/${chat.whatsappConversationId}`}>
                                <MessageCircle className="size-3.5 text-emerald-600" />
                                <span className="hidden sm:inline">WhatsApp chat</span>
                            </Link>
                        </Button>
                    )}
                    {!ended && !onWhatsApp && (
                        <Button variant="ghost" size="icon" className="size-8" aria-label="End chat" title="End this chat" onClick={() => setConfirmEnd(true)}>
                            <XCircle className="size-4" />
                        </Button>
                    )}
                    <Button variant={infoOpen ? 'secondary' : 'ghost'} size="icon" className="size-8" aria-label="Contact info" aria-pressed={infoOpen} title="Contact info" onClick={onToggleInfo}>
                        <Info className="size-4" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
                <div className="px-4 py-4">
                    {!joined ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div ref={contentRef}>
                            {days.map((day) => (
                                <div key={day.label}>
                                    <div className="sticky top-0 z-10 flex items-center justify-center py-2">
                                        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground shadow-sm">{day.label}</span>
                                    </div>
                                    {day.runs.map((run) =>
                                        run.messages.map((m, i) => {
                                            if (m.senderModel === 'System') {
                                                return (
                                                    <p key={m._id} className="my-2 mx-auto w-fit max-w-[85%] rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
                                                        {m.content}
                                                    </p>
                                                );
                                            }
                                            const isMe = m.senderModel === 'Staff';
                                            const first = i === 0;
                                            const lastInRun = i === run.messages.length - 1;
                                            return (
                                                <motion.div
                                                    key={m._id}
                                                    initial={openedWith.has(m._id) ? false : { opacity: 0, y: 14, scale: 0.94 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    transition={bubbleSpring}
                                                    style={{ transformOrigin: isMe ? 'bottom right' : 'bottom left' }}
                                                    className={cn('flex flex-col rounded-2xl', isMe ? 'items-end' : 'items-start', first ? 'mt-3' : 'mt-0.5')}
                                                >
                                                    {first && isMe && m.sender !== agent.id && (
                                                        <span className="mb-1 px-1 text-[10px] font-medium text-muted-foreground">{m.senderName}</span>
                                                    )}
                                                    <div
                                                        className={cn(
                                                            'relative max-w-[85%] md:max-w-[70%] text-sm leading-relaxed break-words shadow-sm px-3 py-1.5',
                                                            bubbleCorners(isMe, first, lastInRun),
                                                            isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                                                        )}
                                                    >
                                                        {m.content && <span className="whitespace-pre-wrap">{m.content}</span>}
                                                        {m.attachments?.map((url, k) => (
                                                            <AttachmentPreview key={k} url={url} />
                                                        ))}
                                                        <span className={cn('float-right ml-2 mt-1.5 flex items-center gap-1 text-[10px] leading-none', isMe ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                                                            {formatTime(m.createdAt)}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            );
                                        }),
                                    )}
                                </div>
                            ))}
                            {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.</p>}
                            {typing && <p className="mt-2 px-1 text-xs text-muted-foreground">{typing} is typing…</p>}
                            <div className="pointer-events-none sticky bottom-3 z-20 h-0">
                                <AnimatePresence>
                                    {leftBottom && (
                                        <motion.button
                                            type="button"
                                            aria-label="Jump to latest message"
                                            initial={{ opacity: 0, scale: 0.6, y: 8 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.6, y: 8 }}
                                            transition={bubbleSpring}
                                            onClick={() => {
                                                const v = contentRef.current?.closest<HTMLElement>('[data-slot=scroll-area-viewport]');
                                                stickToBottom.current = true;
                                                v?.scrollTo({ top: v.scrollHeight, behavior: 'smooth' });
                                            }}
                                            className="pointer-events-auto absolute right-0 bottom-0 flex size-10 items-center justify-center rounded-full border bg-popover text-foreground shadow-lg hover:bg-muted"
                                        >
                                            <ChevronDown className="size-5" />
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <Separator />
            {ended ? (
                <p className="shrink-0 bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">This chat has ended.</p>
            ) : onWhatsApp ? (
                <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/40 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5 text-sm">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                            <MessageCircle className="size-4" />
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate font-medium">This chat continues on WhatsApp</span>
                            <span className="block text-xs text-muted-foreground">Replies from here are turned off. Message the visitor in the WhatsApp chat.</span>
                        </span>
                    </div>
                    <Button asChild size="sm" variant="outline">
                        <Link href={`/messages/${chat?.whatsappConversationId}`}>Open WhatsApp chat</Link>
                    </Button>
                </div>
            ) : !assignee ? (
                // Nobody has this chat yet: join first, then the composer appears.
                <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/40 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5 text-sm">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <UserCheck className="size-4" />
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate font-medium">Join this chat to reply</span>
                            <span className="block text-xs text-muted-foreground">The visitor sees that you joined. It stays yours until a teammate takes it over.</span>
                        </span>
                    </div>
                    <Button size="sm" disabled={joining || !chat} onClick={() => void join()}>
                        {joining && <Loader2 className="size-4 animate-spin" />}
                        Join chat
                    </Button>
                </div>
            ) : lockedByOther ? (
                <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/40 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5 text-sm">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Lock className="size-4" />
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate font-medium">{assignee.name} is handling this chat</span>
                            <span className="block text-xs text-muted-foreground">
                                {agent.canManage ? 'Take it over to reply — they’ll see it move to you.' : 'Only they can reply. Ask them or a manager to hand it over.'}
                            </span>
                        </span>
                    </div>
                    {agent.canManage && (
                        <Button size="sm" variant="outline" disabled={joining} onClick={() => void join()}>
                            Take over
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    <AttachmentTray items={pending} onRemove={removeAttachment} />
                    <form onSubmit={send} className="flex items-end gap-1.5 md:gap-2 px-2 md:px-3 py-2 md:py-3 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                        <AttachMenu onPick={addAttachments} />
                        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                            <PopoverTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Emoji">
                                    <Smile className="size-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="start" className="w-fit p-0">
                                <EmojiPicker className="h-[342px]" onEmojiSelect={({ emoji }) => insertEmoji(emoji)}>
                                    <EmojiPickerSearch />
                                    <EmojiPickerContent />
                                    <EmojiPickerFooter />
                                </EmojiPicker>
                            </PopoverContent>
                        </Popover>
                        <Textarea
                            ref={inputRef}
                            rows={1}
                            value={draft}
                            onChange={onChange}
                            onKeyDown={onKeyDown}
                            placeholder={pending.length ? 'Add a caption' : 'Type a message'}
                            className="min-h-10 max-h-36 overflow-y-auto py-2.5 leading-5"
                            autoFocus={!isMobile}
                        />
                        <Button type="submit" size="icon" className="size-10 shrink-0 rounded-full" aria-label="Send" disabled={(!draft.trim() && !pending.length) || sending || !joined}>
                            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        </Button>
                    </form>
                </>
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
