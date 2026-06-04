'use client';

import { useState, useRef, useEffect, useCallback, Fragment, type ReactNode } from 'react';
import {
    MessageCircle, X, Send, User, Ticket, Headphones,
    RotateCcw, CalendarCheck, ArrowLeft, Mail, Loader2,
    Paperclip, FileText, Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, type Socket } from 'socket.io-client';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
const AVATAR_URL = 'https://res.cloudinary.com/dny7zfbg9/image/upload/v1780327707/lnb5suhev8hzgixi0bbp.png';

// sessionStorage keys for AI-conversation persistence (per-tab; new tab = fresh convo)
const AI_CONVO_ID_KEY = 'webbriks_ai_conversation_id';
const AI_HISTORY_KEY = 'webbriks_ai_history';

// localStorage keys for live-chat session persistence (survives a tab close — an
// agent may reply hours later, unlike the anonymous AI thread)
const LIVE_SESSION_ID_KEY = 'webbriks_live_session_id';
const LIVE_GUEST_TOKEN_KEY = 'webbriks_live_guest_token';
const LIVE_MODE_KEY = 'webbriks_live_mode';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
    action?: 'continue' | 'create_ticket' | 'connect_live_support' | 'book_consultation';
    actionReason?: string;
}

interface LiveMessage {
    _id: string;
    content: string;
    senderModel: 'Client' | 'Staff' | 'Guest' | 'System';
    senderName: string;
    createdAt: string;
    attachments?: string[];
}

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

function isImageUrl(url: string): boolean {
    return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}

function getFileName(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        return decodeURIComponent(pathname.split('/').pop() || 'file');
    } catch {
        return 'file';
    }
}

function extractS3Key(url: string): string | null {
    try {
        const u = new URL(url);
        const key = u.pathname.replace(/^\//, '');
        if (key.startsWith('chats/') || key.startsWith('tickets/')) return key;
    } catch {
        if (url.startsWith('chats/') || url.startsWith('tickets/')) return url;
    }
    return null;
}

function WidgetAttachment({ url, token }: { url: string; token: string | null }) {
    const [viewUrl, setViewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const fileKey = extractS3Key(url);
        if (!fileKey || !token) {
            setViewUrl(url);
            setLoading(false);
            return;
        }

        fetch(`${API_URL}/api/support/attachments/view-url?fileKey=${encodeURIComponent(fileKey)}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                if (!cancelled) {
                    if (data.success) {
                        setViewUrl(data.data.viewUrl);
                    } else {
                        setError(true);
                    }
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setError(true);
                    setLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, [url, token]);

    if (loading) {
        return (
            <div className="mt-1.5 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-[#A7ADBE]" />
                <span className="text-[11px] text-[#A7ADBE]">Loading...</span>
            </div>
        );
    }

    if (error || !viewUrl) {
        return (
            <div className="mt-1.5 text-[11px] text-[#A7ADBE]/60">Attachment unavailable</div>
        );
    }

    if (isImageUrl(url)) {
        return (
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
                <img
                    src={viewUrl}
                    alt="Attachment"
                    className="max-w-[180px] max-h-[120px] rounded-lg object-cover"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                    loading="lazy"
                />
            </a>
        );
    }

    return (
        <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors hover:brightness-125 max-w-[180px]"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
            <FileText className="h-3.5 w-3.5 shrink-0 text-[#A7ADBE]" />
            <span className="truncate flex-1 text-[#E0E4ED]">{getFileName(url)}</span>
            <Download className="h-3 w-3 shrink-0 text-[#A7ADBE]" />
        </a>
    );
}

type Mode = 'ai' | 'guest-login' | 'live-chat';
type GuestStep = 'info' | 'otp';

// ─── Animations ──────────────────────────────────────────────────────────────

const messageVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypingIndicator() {
    return (
        <div className="flex items-center gap-1 px-1 py-1">
            {[0, 200, 400].map((delay) => (
                <motion.span
                    key={delay}
                    className="h-2 w-2 rounded-full bg-[#A7ADBE]"
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: delay / 1000 }}
                />
            ))}
        </div>
    );
}

// ─── Notification sound ──────────────────────────────────────────────────────
// Tiny self-contained "beep" via the Web Audio API — no asset, no import.
// Fully defensive: autoplay limits / unsupported browsers must never throw.
function playNotificationSound() {
    try {
        const Ctx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
        if (!Ctx) return;

        const ctx = new Ctx();
        // If the browser blocks audio until a user gesture, skip silently.
        if (ctx.state === 'suspended') {
            ctx.close().catch(() => {});
            return;
        }

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, now);

        // Soft attack + decay to avoid an audible click.
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.16);
        osc.onended = () => ctx.close().catch(() => {});
    } catch {
        // ignore — sound is best-effort only
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PART A — Safe, dependency-free Markdown renderer (AI replies only)
// Builds React nodes (no dangerouslySetInnerHTML, no raw HTML injection).
// Supports: **bold**, *italic*, `code`, [text](http/https url), bullet/numbered
// lists, paragraphs/line breaks. Malformed patterns fall back to plain text.
// ═══════════════════════════════════════════════════════════════════════════

function parseInline(text: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    // bold | italic | code | [text](url)
    const re =
        /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let key = 0;
    let m: RegExpExecArray | null;

    while ((m = re.exec(text)) !== null) {
        if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index));

        if (m[2] !== undefined) {
            nodes.push(<strong key={key++}>{m[2]}</strong>);
        } else if (m[4] !== undefined) {
            nodes.push(<em key={key++}>{m[4]}</em>);
        } else if (m[6] !== undefined) {
            nodes.push(
                <code
                    key={key++}
                    className="rounded bg-black/30 px-1 py-0.5 font-mono text-[12px]"
                >
                    {m[6]}
                </code>,
            );
        } else if (m[8] !== undefined) {
            const url = m[9];
            // Only allow http/https — strip javascript: and other schemes.
            if (/^https?:\/\//i.test(url)) {
                nodes.push(
                    <a
                        key={key++}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#b98bff] underline underline-offset-2 hover:text-[#cdacff]"
                    >
                        {m[8]}
                    </a>,
                );
            } else {
                // Unsafe scheme → render the literal markdown as plain text.
                nodes.push(m[0]);
            }
        }
        lastIndex = re.lastIndex;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
    return nodes;
}

function MarkdownText({ text }: { text: string }) {
    const lines = (text ?? '').split('\n');
    const blocks: ReactNode[] = [];
    const ulRe = /^\s*[-*]\s+(.*)$/;
    const olRe = /^\s*\d+\.\s+(.*)$/;
    let i = 0;
    let key = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (ulRe.test(line)) {
            const items: string[] = [];
            while (i < lines.length) {
                const mm = ulRe.exec(lines[i]);
                if (!mm) break;
                items.push(mm[1]);
                i++;
            }
            blocks.push(
                <ul key={key++} className="list-disc pl-5 space-y-0.5">
                    {items.map((it, k) => (
                        <li key={k}>{parseInline(it)}</li>
                    ))}
                </ul>,
            );
            continue;
        }

        if (olRe.test(line)) {
            const items: string[] = [];
            while (i < lines.length) {
                const mm = olRe.exec(lines[i]);
                if (!mm) break;
                items.push(mm[1]);
                i++;
            }
            blocks.push(
                <ol key={key++} className="list-decimal pl-5 space-y-0.5">
                    {items.map((it, k) => (
                        <li key={k}>{parseInline(it)}</li>
                    ))}
                </ol>,
            );
            continue;
        }

        if (line.trim() === '') {
            i++;
            continue;
        }

        // Paragraph: gather consecutive non-blank, non-list lines.
        const para: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !ulRe.test(lines[i]) &&
            !olRe.test(lines[i])
        ) {
            para.push(lines[i]);
            i++;
        }
        blocks.push(
            <p key={key++} className="m-0">
                {para.map((pl, k) => (
                    <Fragment key={k}>
                        {k > 0 && <br />}
                        {parseInline(pl)}
                    </Fragment>
                ))}
            </p>,
        );
    }

    return <div className="space-y-1.5">{blocks}</div>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function FloatingAIChat() {
    // ── shared state ─────────────────────────────────────────────────────────
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<Mode>('ai');
    const [unreadCount, setUnreadCount] = useState(0);

    // ── AI chat state ────────────────────────────────────────────────────────
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // ── Guest login state ────────────────────────────────────────────────────
    const [guestStep, setGuestStep] = useState<GuestStep>('info');
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [guestToken, setGuestToken] = useState<string | null>(null);
    const [guestLoading, setGuestLoading] = useState(false);
    const [guestError, setGuestError] = useState('');

    // ── Live chat state ──────────────────────────────────────────────────────
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
    const [liveInput, setLiveInput] = useState('');
    const [agentTyping, setAgentTyping] = useState<string | null>(null);
    const [chatEnded, setChatEnded] = useState(false);

    // ── file upload state ──────────────────────────────────────────────────
    const [liveUploading, setLiveUploading] = useState(false);
    const [liveUploadError, setLiveUploadError] = useState('');

    // ── refs ─────────────────────────────────────────────────────────────────
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const liveInputRef = useRef<HTMLTextAreaElement>(null);
    const liveFileInputRef = useRef<HTMLInputElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // True while a token-based silent reconnect is in flight, so connect_error can
    // fall back to OTP (instead of looping) when the stored token is dead.
    const silentReconnectRef = useRef(false);
    // Mirror isOpen so the long-lived socket handlers read a fresh value
    // (avoids a stale-closure bug when deciding whether to badge/beep).
    const isOpenRef = useRef(isOpen);
    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    // Opening the panel (by any path) clears the unread badge.
    useEffect(() => {
        if (isOpen) setUnreadCount(0);
    }, [isOpen]);

    // ── PART B: live-chat "Seen" state ───────────────────────────────────────
    // Mirror mode for the same stale-closure reason as isOpen.
    const modeRef = useRef(mode);
    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);
    // Has the agent seen the visitor's most recent sent message?
    const [agentHasSeen, setAgentHasSeen] = useState(false);
    // True while there's an unacknowledged agent message (guards seen emits).
    const hasUnseenAgentRef = useRef(false);

    // When the visitor starts viewing live chat, tell the agent we've seen their
    // messages — but only if there's actually an unread agent message.
    useEffect(() => {
        if (
            isOpen &&
            mode === 'live-chat' &&
            hasUnseenAgentRef.current &&
            socketRef.current &&
            sessionId
        ) {
            socketRef.current.emit('chat:seen', { sessionId });
            hasUnseenAgentRef.current = false;
        }
    }, [isOpen, mode, sessionId]);

    // ── helpers ──────────────────────────────────────────────────────────────
    const scrollToBottom = useCallback(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, liveMessages, isLoading, agentTyping, scrollToBottom]);

    useEffect(() => {
        if (isOpen && mode === 'ai' && inputRef.current) inputRef.current.focus();
        if (isOpen && mode === 'live-chat' && liveInputRef.current) liveInputRef.current.focus();
    }, [isOpen, mode]);

    // scroll containment — prevent wheel events from reaching the main page
    const chatPanelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!isOpen) return;
        const panel = chatPanelRef.current;
        if (!panel) return;

        function handleWheel(e: WheelEvent) {
            e.stopPropagation();

            const scrollable = messagesContainerRef.current;
            if (!scrollable) return;
            const { scrollTop, scrollHeight, clientHeight } = scrollable;
            const atTop = scrollTop <= 0 && e.deltaY < 0;
            const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
            if (atTop || atBottom) e.preventDefault();
        }

        panel.addEventListener('wheel', handleWheel, { passive: false });
        return () => panel.removeEventListener('wheel', handleWheel);
    }, [isOpen, mode]);

    // cleanup socket on unmount
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    // ── AI conversation persistence (sessionStorage) ─────────────────────────
    // Rehydrate the AI conversation id + model context on mount so a refresh
    // resumes the same conversation. Also restore a minimal visible thread from
    // the stored history so the panel matches what the AI "remembers".
    useEffect(() => {
        try {
            const savedHistory = sessionStorage.getItem(AI_HISTORY_KEY);
            if (savedHistory) {
                const parsed: AIChatMessage[] = JSON.parse(savedHistory);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setChatHistory(parsed);
                    setMessages(
                        parsed.map((m, i) => ({
                            id: `restored-${i}`,
                            role: m.role === 'user' ? 'user' : 'assistant',
                            text: m.parts?.[0]?.text ?? '',
                        })),
                    );
                }
            }
            const savedId = sessionStorage.getItem(AI_CONVO_ID_KEY);
            if (savedId) setConversationId(savedId);
        } catch {
            // sessionStorage can be unavailable (private mode / blocked) — ignore.
        }
    }, []);

    // Persist the conversation id whenever it changes (non-null only).
    useEffect(() => {
        if (!conversationId) return;
        try {
            sessionStorage.setItem(AI_CONVO_ID_KEY, conversationId);
        } catch {
            // ignore storage failures
        }
    }, [conversationId]);

    // Persist the model context whenever it changes. Skip empty arrays so the
    // initial mount (and resetAll) never clobbers a freshly-restored history.
    useEffect(() => {
        if (chatHistory.length === 0) return;
        try {
            sessionStorage.setItem(AI_HISTORY_KEY, JSON.stringify(chatHistory));
        } catch {
            // ignore storage failures
        }
    }, [chatHistory]);

    // ── Live chat session persistence (localStorage) ─────────────────────────
    // Reconnect to an in-progress live support session on mount so a refresh (or
    // tab close/reopen) drops the visitor back into the same chat. Only the
    // token + sessionId are stored; the server replays full history via
    // `chat:joined` on reconnect, which also sets mode to 'live-chat'. Runs after
    // the AI rehydration above, so the live reconnect takes precedence for mode.
    useEffect(() => {
        try {
            const savedMode = localStorage.getItem(LIVE_MODE_KEY);
            const savedSid = localStorage.getItem(LIVE_SESSION_ID_KEY);
            const savedToken = localStorage.getItem(LIVE_GUEST_TOKEN_KEY);
            if (savedMode === 'live-chat' && savedSid && savedToken) {
                setSessionId(savedSid);
                setGuestToken(savedToken);
                connectToLiveChat(savedToken, savedSid);
            }
        } catch {
            // localStorage can be unavailable (private mode / blocked) — ignore.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist the live session id while it is active.
    useEffect(() => {
        if (!sessionId) return;
        try {
            localStorage.setItem(LIVE_SESSION_ID_KEY, sessionId);
        } catch {
            // ignore storage failures
        }
    }, [sessionId]);

    // Persist the guest token while it is active.
    useEffect(() => {
        if (!guestToken) return;
        try {
            localStorage.setItem(LIVE_GUEST_TOKEN_KEY, guestToken);
        } catch {
            // ignore storage failures
        }
    }, [guestToken]);

    // Persist the mode only while in live chat. Clearing is handled explicitly on
    // chat end / connect failure / reset — never when the mode merely changes away.
    useEffect(() => {
        if (mode !== 'live-chat') return;
        try {
            localStorage.setItem(LIVE_MODE_KEY, 'live-chat');
        } catch {
            // ignore storage failures
        }
    }, [mode]);

    // ── AI Chat ──────────────────────────────────────────────────────────────

    function openChat() {
        setIsOpen(true);
        if (messages.length === 0) {
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                text: "Hi! I'm the Web Briks AI assistant. I can help you with questions about our services, pricing, and more. How can I help you today?",
            }]);
        }
    }

    function resetAll() {
        // disconnect live chat if active
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setMode('ai');
        setMessages([{
            id: 'welcome-' + Date.now(),
            role: 'assistant',
            text: "Hi! I'm the Web Briks AI assistant. I can help you with questions about our services, pricing, and more. How can I help you today?",
        }]);
        setChatHistory([]);
        setConversationId(null);
        try {
            sessionStorage.removeItem(AI_CONVO_ID_KEY);
            sessionStorage.removeItem(AI_HISTORY_KEY);
        } catch {
            // ignore storage failures
        }
        try {
            localStorage.removeItem(LIVE_SESSION_ID_KEY);
            localStorage.removeItem(LIVE_GUEST_TOKEN_KEY);
            localStorage.removeItem(LIVE_MODE_KEY);
        } catch {
            // ignore storage failures
        }
        setInput('');
        setGuestStep('info');
        setGuestName('');
        setGuestEmail('');
        setOtp('');
        setGuestToken(null);
        setGuestError('');
        setSessionId(null);
        setLiveMessages([]);
        setLiveInput('');
        setAgentTyping(null);
        setChatEnded(false);
        setLiveUploading(false);
        setLiveUploadError('');
    }

    // Header back arrow. Leaving an ACTIVE live chat keeps the session alive (so
    // the visitor can return via reconnect) and just tells the agent we're away.
    // Otherwise (guest-login, or an already-ended chat) fall back to a full reset.
    function handleHeaderBack() {
        if (mode === 'live-chat' && socketRef.current && sessionId && !chatEnded) {
            socketRef.current.emit('chat:visitor_away', { sessionId });
            setMode('ai');
            return;
        }
        resetAll();
    }

    async function sendAIMessage(e?: React.FormEvent) {
        e?.preventDefault();
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsg: DisplayMessage = { id: `user-${Date.now()}`, role: 'user', text };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            let data: any = null;
            let lastError: Error | null = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));
                try {
                    const res = await fetch(`${API_URL}/api/ai-chat/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ message: text, history: chatHistory, conversationId }),
                    });
                    data = await res.json();
                    if (data.success) break;
                    lastError = new Error(data.message);
                    if (!data.retryable) break;
                } catch (err) {
                    lastError = err instanceof Error ? err : new Error('Network error');
                }
            }
            if (!data?.success) throw lastError || new Error('Failed to get AI response');

            const { reply, action, actionReason } = data.data;
            // Capture the server-issued conversation id so every later turn
            // re-sends it and appends to the same conversation document.
            if (data.conversationId) setConversationId(data.conversationId);
            setMessages((prev) => [...prev, {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                text: reply,
                action,
                actionReason,
            }]);
            setChatHistory((prev) => [
                ...prev,
                { role: 'user', parts: [{ text }] },
                { role: 'model', parts: [{ text: reply }] },
            ]);
        } catch {
            setMessages((prev) => [...prev, {
                id: `error-${Date.now()}`,
                role: 'system',
                text: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
            }]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    }

    async function handleCreateTicket() {
        setIsLoading(true);
        const conversationSummary = messages
            .filter((m) => m.role !== 'system')
            .map((m) => `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.text}`)
            .join('\n');

        try {
            const res = await fetch(`${API_URL}/api/ai-chat/ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ subject: 'Support Request from AI Chat', description: conversationSummary, chatHistory }),
            });
            const data = await res.json();
            if (data.success) {
                setMessages((prev) => [...prev, {
                    id: `system-${Date.now()}`,
                    role: 'system',
                    text: `A support ticket has been created (${data.data?.ticketId || 'submitted'}). Our team will review it and get back to you soon!`,
                }]);
            } else throw new Error(data.message);
        } catch {
            setMessages((prev) => [...prev, {
                id: `system-${Date.now()}`,
                role: 'system',
                text: 'To create a ticket, please verify your identity first. You can use the support portal to submit a ticket with your email.',
            }]);
        } finally {
            setIsLoading(false);
        }
    }

    // Token is dead/expired → forget it and route the visitor to the OTP screen.
    function clearGuestTokenAndShowOtp(message?: string) {
        try {
            localStorage.removeItem(LIVE_GUEST_TOKEN_KEY);
        } catch {
            // ignore storage failures
        }
        setGuestToken(null);
        setMode('guest-login');
        setGuestStep('info');
        setGuestError(message ?? 'Please verify your email to continue.');
        silentReconnectRef.current = false;
    }

    // Single code path that turns a (valid) guest token into a live session.
    // Used by both the OTP-verify success flow and the silent reconnect.
    async function startLiveSupport(token: string) {
        setGuestLoading(true);
        silentReconnectRef.current = true;
        try {
            const sessionRes = await fetch(`${API_URL}/api/support/chats/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            // Token rejected → treat as dead and fall back to OTP (no loop).
            if (sessionRes.status === 401 || sessionRes.status === 403) {
                clearGuestTokenAndShowOtp(
                    'Your session has expired. Please verify your email to continue.',
                );
                return;
            }

            const sessionData = await sessionRes.json();
            if (!sessionRes.ok || !sessionData.success) {
                clearGuestTokenAndShowOtp(
                    'Your session has expired. Please verify your email to continue.',
                );
                return;
            }

            const sid = sessionData.data.sessionId;
            setSessionId(sid);
            setGuestToken(token);
            connectToLiveChat(token, sid);
        } catch {
            // Couldn't reach the session endpoint — fall back to OTP cleanly.
            clearGuestTokenAndShowOtp(
                'Could not reconnect. Please verify your email to continue.',
            );
        } finally {
            setGuestLoading(false);
        }
    }

    function handleConnectLive() {
        // Reuse a stored guest token (valid 7 days) instead of re-asking for OTP.
        let token: string | null = guestToken;
        if (!token) {
            try {
                token = localStorage.getItem(LIVE_GUEST_TOKEN_KEY);
            } catch {
                token = null;
            }
        }

        if (token) {
            void startLiveSupport(token);
            return;
        }

        // No token → collect email + OTP.
        setMode('guest-login');
        setGuestStep('info');
        setGuestError('');
    }

    // ── Guest Login ──────────────────────────────────────────────────────────

    async function handleRequestOtp(e: React.FormEvent) {
        e.preventDefault();
        if (!guestName.trim() || !guestEmail.trim()) return;
        setGuestLoading(true);
        setGuestError('');

        try {
            const res = await fetch(`${API_URL}/api/support/guest/otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: guestEmail.trim(), name: guestName.trim() }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            setGuestStep('otp');
        } catch (err: any) {
            setGuestError(err.message || 'Failed to send OTP. Please try again.');
        } finally {
            setGuestLoading(false);
        }
    }

    async function handleVerifyOtp(e: React.FormEvent) {
        e.preventDefault();
        if (!otp.trim()) return;
        setGuestLoading(true);
        setGuestError('');

        try {
            const res = await fetch(`${API_URL}/api/support/guest/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: guestEmail.trim(), otp: otp.trim() }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            const token = data.data.token;
            setGuestToken(token);

            // Single path: turn the fresh token into a live session.
            await startLiveSupport(token);
        } catch (err: any) {
            setGuestError(err.message || 'Verification failed. Please try again.');
        } finally {
            setGuestLoading(false);
        }
    }

    // ── Live Chat Socket ─────────────────────────────────────────────────────

    function connectToLiveChat(token: string, sid: string) {
        const socket = io(`${API_URL}/support`, {
            auth: { token },
            transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('chat:join', { sessionId: sid });
        });

        socket.on('chat:joined', ({ messages: history }: { messages: LiveMessage[] }) => {
            // Genuine connection — a later network blip shouldn't be read as a dead token.
            silentReconnectRef.current = false;
            if (history?.length) setLiveMessages(history);
            setMode('live-chat');
        });

        socket.on('chat:message', (msg: LiveMessage) => {
            setLiveMessages((prev) => {
                if (prev.some((m) => m._id === msg._id)) return prev;
                return [...prev, msg];
            });
            setAgentTyping(null);

            // Notify only when the panel is closed and the message is from an
            // agent/system (not the visitor's own message echoed back).
            const fromAgent =
                msg.senderModel === 'Staff' || msg.senderModel === 'System';
            if (!isOpenRef.current && fromAgent) {
                setUnreadCount((c) => c + 1);
                playNotificationSound();
            }

            // PART B: track unread agent replies; if the visitor is actively
            // viewing live chat, immediately tell the agent we've seen it.
            if (msg.senderModel === 'Staff') {
                hasUnseenAgentRef.current = true;
                if (isOpenRef.current && modeRef.current === 'live-chat') {
                    socket.emit('chat:seen', { sessionId: sid });
                    hasUnseenAgentRef.current = false;
                }
            }
        });

        // PART B: the agent read the visitor's messages → mark the last own
        // message as seen. (Server emits this to the room, excluding the sender,
        // so the visitor only receives it when the AGENT has seen.)
        socket.on('chat:seen', () => {
            setAgentHasSeen(true);
        });

        socket.on('chat:agent_joined', ({ agentName }: { agentName: string }) => {
            setLiveMessages((prev) => [...prev, {
                _id: `system-agent-${Date.now()}`,
                content: `${agentName} has joined the chat.`,
                senderModel: 'System',
                senderName: 'System',
                createdAt: new Date().toISOString(),
            }]);
        });

        socket.on('chat:typing', ({ userName, isTyping }: { userName: string; isTyping: boolean }) => {
            setAgentTyping(isTyping ? userName : null);
        });

        socket.on('chat:closed', ({ endedBy }: { endedBy: string }) => {
            setChatEnded(true);
            // Session is dead — never restore it on reload.
            try {
                localStorage.removeItem(LIVE_SESSION_ID_KEY);
                localStorage.removeItem(LIVE_GUEST_TOKEN_KEY);
                localStorage.removeItem(LIVE_MODE_KEY);
            } catch {
                // ignore storage failures
            }
            setLiveMessages((prev) => [...prev, {
                _id: `system-closed-${Date.now()}`,
                content: `Chat ended by ${endedBy}.`,
                senderModel: 'System',
                senderName: 'System',
                createdAt: new Date().toISOString(),
            }]);
        });

        socket.on('connect_error', () => {
            // Token-based silent attempt failed → the stored token is bad/expired.
            // Fall back to OTP cleanly instead of looping a dead-token reconnect.
            if (silentReconnectRef.current) {
                silentReconnectRef.current = false;
                clearGuestTokenAndShowOtp(
                    'Your session has expired. Please verify your email to continue.',
                );
                return;
            }

            setGuestError('Failed to connect to live chat. Please try again.');
            setMode('guest-login');
            // Drop a permanently-dead session so reload doesn't keep retrying it.
            try {
                localStorage.removeItem(LIVE_SESSION_ID_KEY);
                localStorage.removeItem(LIVE_GUEST_TOKEN_KEY);
                localStorage.removeItem(LIVE_MODE_KEY);
            } catch {
                // ignore storage failures
            }
        });
    }

    function sendLiveMessage(e?: React.FormEvent) {
        e?.preventDefault();
        const text = liveInput.trim();
        if (!text || !socketRef.current || !sessionId || chatEnded) return;

        socketRef.current.emit('chat:message', { sessionId, text });
        setLiveInput('');
        liveInputRef.current?.focus();
        // PART B: the new message isn't seen until the agent reads it next.
        setAgentHasSeen(false);
    }

    async function handleLiveFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files?.length || !sessionId || !guestToken || chatEnded) return;

        setLiveUploading(true);
        setLiveUploadError('');
        const uploadedUrls: string[] = [];

        for (const file of Array.from(files)) {
            if (file.size > MAX_UPLOAD_SIZE) {
                setLiveUploadError(`${file.name} exceeds 10MB limit.`);
                continue;
            }

            try {
                const presignRes = await fetch(`${API_URL}/api/support/attachments/presigned-url`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${guestToken}`,
                    },
                    body: JSON.stringify({
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        folder: 'chats',
                        referenceId: sessionId,
                    }),
                });

                const presignData = await presignRes.json();
                if (!presignRes.ok || !presignData.success) {
                    throw new Error(presignData.message || 'Failed to get upload URL');
                }

                const { uploadUrl, fileUrl } = presignData.data;

                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': file.type },
                    body: file,
                });

                if (!uploadRes.ok) {
                    throw new Error(`Upload failed (${uploadRes.status})`);
                }

                uploadedUrls.push(fileUrl);
            } catch (err: any) {
                console.error('File upload failed:', err);
                setLiveUploadError(err.message || `Failed to upload ${file.name}`);
            }
        }

        if (uploadedUrls.length > 0 && socketRef.current && sessionId) {
            socketRef.current.emit('chat:message', {
                sessionId,
                text: '',
                attachments: uploadedUrls,
            });
        }

        setLiveUploading(false);
        if (liveFileInputRef.current) liveFileInputRef.current.value = '';
    }

    function handleLiveInputChange(value: string) {
        setLiveInput(value);
        if (!socketRef.current || !sessionId) return;

        socketRef.current.emit('chat:typing', { sessionId, isTyping: true });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current?.emit('chat:typing', { sessionId, isTyping: false });
        }, 1500);
    }

    // ── Render ───────────────────────────────────────────────────────────────

    const headerTitle = mode === 'ai'
        ? 'Web Briks AI Assistant'
        : mode === 'guest-login'
            ? 'Connect to Support'
            : 'Live Support';

    // PART B: index of the visitor's most recent sent message (for the "Seen" tag).
    let lastOwnLiveIndex = -1;
    for (let j = liveMessages.length - 1; j >= 0; j--) {
        if (liveMessages[j].senderModel === 'Guest') {
            lastOwnLiveIndex = j;
            break;
        }
    }

    return (
        <>
            {/* Floating button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        onClick={openChat}
                        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
                        style={{
                            background: 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)',
                            boxShadow: '0 0 24px 0 rgba(106, 37, 224, 0.5)',
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label="Open AI Chat"
                    >
                        <MessageCircle className="h-6 w-6 text-white" />
                        {unreadCount > 0 && (
                            <span
                                aria-label={`${unreadCount} unread messages`}
                                className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-[#0A0E1A]"
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={chatPanelRef}
                        initial={{ opacity: 0, y: 24, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        className="fixed bottom-6 right-6 z-50 flex h-130 w-95 flex-col overflow-hidden rounded-2xl shadow-2xl"
                        style={{
                            background: '#0A0E1A',
                            border: '1px solid rgba(51, 102, 255, 0.3)',
                            boxShadow: '0 0 40px 0 rgba(51, 102, 255, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-center justify-between px-4 py-3 shrink-0"
                            style={{
                                background: mode === 'live-chat'
                                    ? 'linear-gradient(135deg, #3366FF 0%, #1A4FFF 100%)'
                                    : 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)',
                            }}
                        >
                            <div className="flex items-center gap-2">
                                {mode !== 'ai' && (
                                    <button
                                        onClick={handleHeaderBack}
                                        className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </button>
                                )}
                                <Image src={AVATAR_URL} alt="Web Briks" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
                                <h3 className="text-sm font-semibold text-white">{headerTitle}</h3>
                            </div>
                            <div className="flex items-center gap-1">
                                {mode === 'ai' && (
                                    <button
                                        onClick={resetAll}
                                        className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                        title="Reset conversation"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* ── AI Chat Mode ──────────────────────────────── */}
                        {mode === 'ai' && (
                            <>
                                <div
                                    ref={messagesContainerRef}
                                    className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3"
                                    style={{ background: '#060A14', touchAction: 'none' }}
                                    onTouchMove={(e) => e.stopPropagation()}
                                >
                                    <AnimatePresence initial={false}>
                                        {messages.map((msg) => (
                                            <motion.div key={msg.id} variants={messageVariants} initial="hidden" animate="visible" layout>
                                                <div className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    {msg.role !== 'user' && (
                                                        <Image src={AVATAR_URL} alt="AI" width={28} height={28} className="mt-1 h-7 w-7 shrink-0 rounded-full object-cover" />
                                                    )}
                                                    <div
                                                        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                                            msg.role === 'user' ? 'text-white' : msg.role === 'system' ? 'text-[#A7ADBE]' : 'text-[#E0E4ED]'
                                                        }`}
                                                        style={
                                                            msg.role === 'user'
                                                                ? { background: 'linear-gradient(134deg, #6A25E0 0%, #390CA4 100%)' }
                                                                : msg.role === 'system'
                                                                    ? { background: '#0F1423', border: '1px solid rgba(51, 102, 255, 0.15)' }
                                                                    : { background: '#161C44' }
                                                        }
                                                    >
                                                        {/* PART A: render markdown for AI replies only;
                                                            user/system stay plain text (no injection). */}
                                                        {msg.role === 'assistant' ? (
                                                            <MarkdownText text={msg.text} />
                                                        ) : (
                                                            msg.text
                                                        )}
                                                    </div>
                                                    {msg.role === 'user' && (
                                                        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#161C44]">
                                                            <User className="h-4 w-4 text-[#A7ADBE]" />
                                                        </div>
                                                    )}
                                                </div>

                                                {msg.action && msg.action !== 'continue' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.15, duration: 0.2 }}
                                                        className="flex gap-2 mt-2 ml-9"
                                                    >
                                                        {msg.action === 'create_ticket' && (
                                                            <button onClick={handleCreateTicket} disabled={isLoading}
                                                                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-all hover:brightness-125 disabled:opacity-50"
                                                                style={{ background: 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)' }}
                                                            >
                                                                <Ticket className="h-3.5 w-3.5" />
                                                                Create Support Ticket
                                                            </button>
                                                        )}
                                                        {msg.action === 'connect_live_support' && (
                                                            <button onClick={handleConnectLive} disabled={isLoading}
                                                                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-all hover:brightness-125 disabled:opacity-50"
                                                                style={{ background: 'linear-gradient(135deg, #3366FF 0%, #1A4FFF 100%)' }}
                                                            >
                                                                <Headphones className="h-3.5 w-3.5" />
                                                                Connect to Live Support
                                                            </button>
                                                        )}
                                                        {msg.action === 'book_consultation' && (
                                                            <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white"
                                                                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                                                            >
                                                                <CalendarCheck className="h-3.5 w-3.5" />
                                                                Consultation Booked!
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    <AnimatePresence>
                                        {isLoading && (
                                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex gap-2">
                                                <Image src={AVATAR_URL} alt="AI" width={28} height={28} className="mt-1 h-7 w-7 shrink-0 rounded-full object-cover" />
                                                <div className="rounded-2xl px-4 py-3" style={{ background: '#161C44' }}>
                                                    <TypingIndicator />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* AI Input */}
                                <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid rgba(51, 102, 255, 0.15)', background: '#0A0E1A' }}>
                                    <div className="flex items-end gap-2 rounded-xl px-3 py-2" style={{ background: '#161C44', border: '1px solid rgba(51, 102, 255, 0.2)' }}>
                                        <textarea
                                            ref={inputRef}
                                            value={input}
                                            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(); } }}
                                            placeholder="Type a message..."
                                            disabled={isLoading}
                                            rows={1}
                                            className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-[#A7ADBE]/50 focus:outline-none disabled:opacity-50"
                                            style={{ maxHeight: '100px', overflowY: 'auto' }}
                                        />
                                        <button
                                            onClick={(e) => { e.preventDefault(); sendAIMessage(); }}
                                            disabled={!input.trim() || isLoading}
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all hover:brightness-125 disabled:opacity-30"
                                            style={{
                                                background: input.trim() && !isLoading
                                                    ? 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)'
                                                    : 'rgba(255,255,255,0.1)',
                                            }}
                                        >
                                            <Send className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Guest Login Mode ─────────────────────────── */}
                        {mode === 'guest-login' && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex-1 flex flex-col px-4 py-6 overflow-y-auto overscroll-contain"
                                style={{ background: '#060A14' }}
                            >
                                <div className="flex-1 flex flex-col justify-center">
                                    <div className="text-center mb-6">
                                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-3"
                                            style={{ background: 'linear-gradient(135deg, #3366FF 0%, #1A4FFF 100%)' }}
                                        >
                                            <Headphones className="h-6 w-6 text-white" />
                                        </div>
                                        <h4 className="text-white font-semibold text-sm">Connect to Live Support</h4>
                                        <p className="text-[#A7ADBE] text-xs mt-1">
                                            {guestStep === 'info'
                                                ? 'Please provide your details to connect with an agent.'
                                                : `We sent a verification code to ${guestEmail}`}
                                        </p>
                                    </div>

                                    {guestStep === 'info' ? (
                                        <form onSubmit={handleRequestOtp} className="space-y-3">
                                            <div>
                                                <label className="text-[11px] text-[#A7ADBE] font-medium uppercase tracking-wider mb-1 block">Name</label>
                                                <input
                                                    type="text"
                                                    value={guestName}
                                                    onChange={(e) => setGuestName(e.target.value)}
                                                    placeholder="Your name"
                                                    required
                                                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#A7ADBE]/40 focus:outline-none focus:ring-1 focus:ring-[#3366FF]/50"
                                                    style={{ background: '#161C44', border: '1px solid rgba(51, 102, 255, 0.2)' }}
                                                    autoFocus
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] text-[#A7ADBE] font-medium uppercase tracking-wider mb-1 block">Email</label>
                                                <input
                                                    type="email"
                                                    value={guestEmail}
                                                    onChange={(e) => setGuestEmail(e.target.value)}
                                                    placeholder="your@email.com"
                                                    required
                                                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#A7ADBE]/40 focus:outline-none focus:ring-1 focus:ring-[#3366FF]/50"
                                                    style={{ background: '#161C44', border: '1px solid rgba(51, 102, 255, 0.2)' }}
                                                />
                                            </div>
                                            {guestError && (
                                                <p className="text-xs text-red-400">{guestError}</p>
                                            )}
                                            <button
                                                type="submit"
                                                disabled={guestLoading || !guestName.trim() || !guestEmail.trim()}
                                                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #3366FF 0%, #1A4FFF 100%)' }}
                                            >
                                                {guestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                                {guestLoading ? 'Sending...' : 'Send Verification Code'}
                                            </button>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleVerifyOtp} className="space-y-3">
                                            <div>
                                                <label className="text-[11px] text-[#A7ADBE] font-medium uppercase tracking-wider mb-1 block">Verification Code</label>
                                                <input
                                                    type="text"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    placeholder="000000"
                                                    required
                                                    maxLength={6}
                                                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white text-center tracking-[0.3em] font-mono placeholder:text-[#A7ADBE]/40 focus:outline-none focus:ring-1 focus:ring-[#3366FF]/50"
                                                    style={{ background: '#161C44', border: '1px solid rgba(51, 102, 255, 0.2)' }}
                                                    autoFocus
                                                />
                                            </div>
                                            {guestError && (
                                                <p className="text-xs text-red-400">{guestError}</p>
                                            )}
                                            <button
                                                type="submit"
                                                disabled={guestLoading || otp.length < 6}
                                                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #3366FF 0%, #1A4FFF 100%)' }}
                                            >
                                                {guestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
                                                {guestLoading ? 'Connecting...' : 'Verify & Connect'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setGuestStep('info'); setOtp(''); setGuestError(''); }}
                                                className="w-full text-xs text-[#A7ADBE] hover:text-white transition-colors"
                                            >
                                                Use a different email
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* ── Live Chat Mode ──────────────────────────── */}
                        {mode === 'live-chat' && (
                            <>
                                <div
                                    ref={messagesContainerRef}
                                    className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
                                    style={{ background: '#060A14', touchAction: 'none' }}
                                    onTouchMove={(e) => e.stopPropagation()}
                                >
                                    {/* Queue waiting message */}
                                    {liveMessages.length === 0 && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center gap-3">
                                            <Loader2 className="h-6 w-6 text-[#3366FF] animate-spin" />
                                            <div>
                                                <p className="text-sm text-white font-medium">Waiting for an agent...</p>
                                                <p className="text-xs text-[#A7ADBE] mt-1">You&apos;re in the queue. An agent will be with you shortly.</p>
                                            </div>
                                        </motion.div>
                                    )}

                                    <AnimatePresence initial={false}>
                                        {liveMessages.map((msg, i) => {
                                            const isMe = msg.senderModel === 'Guest';
                                            const isSystem = msg.senderModel === 'System';
                                            const prev = i > 0 ? liveMessages[i - 1] : null;
                                            // New group when sender changes, across a
                                            // system boundary, or after a >60s gap.
                                            const isFirstInGroup =
                                                !prev ||
                                                prev.senderModel === 'System' ||
                                                msg.senderModel === 'System' ||
                                                prev.senderModel !== msg.senderModel ||
                                                new Date(msg.createdAt).getTime() -
                                                    new Date(prev.createdAt).getTime() >
                                                    60_000;
                                            const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                            return (
                                                <motion.div
                                                    key={msg._id}
                                                    variants={messageVariants}
                                                    initial="hidden"
                                                    animate="visible"
                                                    layout
                                                    className={isSystem || isFirstInGroup ? 'mt-3' : 'mt-0.5'}
                                                >
                                                    {isSystem ? (
                                                        <div className="flex justify-center">
                                                            <span className="text-[11px] text-[#A7ADBE] px-3 py-1 rounded-full" style={{ background: '#0F1423' }}>
                                                                {msg.content}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                            {!isMe && (
                                                                isFirstInGroup ? (
                                                                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: '#1A4FFF' }}>
                                                                        <Headphones className="h-3.5 w-3.5 text-white" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-7 w-7 shrink-0" aria-hidden />
                                                                )
                                                            )}
                                                            <div className="max-w-[75%]">
                                                                {!isMe && isFirstInGroup && (
                                                                    <p className="text-[10px] text-[#A7ADBE] mb-0.5 ml-1">{msg.senderName}</p>
                                                                )}
                                                                <div
                                                                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isMe ? 'text-white' : 'text-[#E0E4ED]'}`}
                                                                    style={isMe
                                                                        ? { background: 'linear-gradient(135deg, #3366FF 0%, #1A4FFF 100%)' }
                                                                        : { background: '#161C44' }
                                                                    }
                                                                >
                                                                    {msg.content && <span>{msg.content}</span>}
                                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                                        <div className="space-y-1">
                                                                            {msg.attachments.map((aUrl, ai) => (
                                                                                <WidgetAttachment key={ai} url={aUrl} token={guestToken} />
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <p className={`text-[10px] text-[#A7ADBE] mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                                                                    {time}
                                                                    {/* PART B: WhatsApp-style "Seen" on the last own message only. */}
                                                                    {isMe && i === lastOwnLiveIndex && agentHasSeen && (
                                                                        <span className="ml-1 text-[#7CC4FF]">· Seen</span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            {isMe && (
                                                                isFirstInGroup ? (
                                                                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#161C44]">
                                                                        <User className="h-4 w-4 text-[#A7ADBE]" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-7 w-7 shrink-0" aria-hidden />
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>

                                    {/* Agent typing */}
                                    <AnimatePresence>
                                        {agentTyping && (
                                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex gap-2 mt-3">
                                                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: '#1A4FFF' }}>
                                                    <Headphones className="h-3.5 w-3.5 text-white" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-[#A7ADBE] mb-0.5 ml-1">{agentTyping}</p>
                                                    <div className="rounded-2xl px-4 py-3" style={{ background: '#161C44' }}>
                                                        <TypingIndicator />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Live Chat Input */}
                                <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid rgba(51, 102, 255, 0.15)', background: '#0A0E1A' }}>
                                    {chatEnded ? (
                                        <button
                                            onClick={resetAll}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all hover:brightness-110"
                                            style={{ background: 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)' }}
                                        >
                                            <MessageCircle className="h-4 w-4" />
                                            Return to AI Assistant
                                        </button>
                                    ) : (
                                        <>
                                            <input
                                                ref={liveFileInputRef}
                                                type="file"
                                                multiple
                                                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,.docx,.xlsx,.txt"
                                                className="hidden"
                                                onChange={handleLiveFileUpload}
                                            />
                                            {liveUploadError && (
                                                <p className="text-[11px] text-red-400 px-1 mb-1">{liveUploadError}</p>
                                            )}
                                            <div className="flex items-end gap-2 rounded-xl px-3 py-2" style={{ background: '#161C44', border: '1px solid rgba(51, 102, 255, 0.2)' }}>
                                                <button
                                                    onClick={() => liveFileInputRef.current?.click()}
                                                    disabled={liveUploading}
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#A7ADBE] transition-all hover:text-white hover:bg-white/5 disabled:opacity-30"
                                                >
                                                    {liveUploading ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Paperclip className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <textarea
                                                    ref={liveInputRef}
                                                    value={liveInput}
                                                    onChange={(e) => { handleLiveInputChange(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendLiveMessage(); } }}
                                                    placeholder="Type a message..."
                                                    rows={1}
                                                    className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-[#A7ADBE]/50 focus:outline-none"
                                                    style={{ maxHeight: '100px', overflowY: 'auto' }}
                                                />
                                                <button
                                                    onClick={(e) => { e.preventDefault(); sendLiveMessage(); }}
                                                    disabled={!liveInput.trim()}
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all hover:brightness-125 disabled:opacity-30"
                                                    style={{
                                                        background: liveInput.trim()
                                                            ? 'linear-gradient(135deg, #3366FF 0%, #1A4FFF 100%)'
                                                            : 'rgba(255,255,255,0.1)',
                                                    }}
                                                >
                                                    <Send className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
