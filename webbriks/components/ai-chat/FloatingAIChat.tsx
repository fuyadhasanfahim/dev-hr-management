'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, User, Ticket, Headphones, RotateCcw, CalendarCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
const AVATAR_URL = 'https://res.cloudinary.com/dny7zfbg9/image/upload/v1780327707/lnb5suhev8hzgixi0bbp.png';

interface ChatMessage {
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

const messageVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

export function FloatingAIChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = useCallback(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, scrollToBottom]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const body = document.body;
        const container = messagesContainerRef.current;
        if (!container) return;

        function handleWheel(e: WheelEvent) {
            const el = container!;
            const { scrollTop, scrollHeight, clientHeight } = el;
            const atTop = scrollTop <= 0 && e.deltaY < 0;
            const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
            if (atTop || atBottom) {
                e.preventDefault();
            }
        }

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [isOpen]);

    function openChat() {
        setIsOpen(true);
        if (messages.length === 0) {
            setMessages([
                {
                    id: 'welcome',
                    role: 'assistant',
                    text: "Hi! I'm the Web Briks AI assistant. I can help you with questions about our services, pricing, and more. How can I help you today?",
                },
            ]);
        }
    }

    function resetChat() {
        setMessages([
            {
                id: 'welcome-' + Date.now(),
                role: 'assistant',
                text: "Hi! I'm the Web Briks AI assistant. I can help you with questions about our services, pricing, and more. How can I help you today?",
            },
        ]);
        setChatHistory([]);
        setInput('');
    }

    async function sendMessage(e?: React.FormEvent) {
        e?.preventDefault();
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsg: DisplayMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            text,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/ai-chat/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: text, history: chatHistory }),
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to get AI response');
            }

            const { reply, action, actionReason } = data.data;

            const assistantMsg: DisplayMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                text: reply,
                action,
                actionReason,
            };
            setMessages((prev) => [...prev, assistantMsg]);

            setChatHistory((prev) => [
                ...prev,
                { role: 'user', parts: [{ text }] },
                { role: 'model', parts: [{ text: reply }] },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: 'system',
                    text: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
                },
            ]);
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
                body: JSON.stringify({
                    subject: 'Support Request from AI Chat',
                    description: conversationSummary,
                    chatHistory,
                }),
            });

            const data = await res.json();

            if (data.success) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `system-${Date.now()}`,
                        role: 'system',
                        text: `A support ticket has been created (${data.data?.ticketId || 'submitted'}). Our team will review it and get back to you soon!`,
                    },
                ]);
            } else {
                throw new Error(data.message);
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `system-${Date.now()}`,
                    role: 'system',
                    text: 'To create a ticket, please verify your identity first. You can use the support portal to submit a ticket with your email.',
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleConnectLive() {
        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/ai-chat/live-support`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });

            const data = await res.json();

            if (data.success) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `system-${Date.now()}`,
                        role: 'system',
                        text: `You've been connected to our live support queue. A support agent will be with you shortly. Session ID: ${data.data?.sessionId || 'pending'}`,
                    },
                ]);
            } else {
                throw new Error(data.message);
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `system-${Date.now()}`,
                    role: 'system',
                    text: 'To connect to live support, please verify your identity first. You can reach us through the support portal.',
                },
            ]);
        } finally {
            setIsLoading(false);
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
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl shadow-2xl"
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
                                background: 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)',
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <Image src={AVATAR_URL} alt="Web Briks AI" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
                                <h3 className="text-sm font-semibold text-white">
                                    Web Briks AI Assistant
                                </h3>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={resetChat}
                                    className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                    title="Reset conversation"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={messagesContainerRef}
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3"
                            style={{ background: '#060A14', touchAction: 'none' }}
                            onTouchMove={(e) => e.stopPropagation()}
                        >
                            <AnimatePresence initial={false}>
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        variants={messageVariants}
                                        initial="hidden"
                                        animate="visible"
                                        layout
                                    >
                                        <div
                                            className={`flex gap-2 ${
                                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                                            }`}
                                        >
                                            {msg.role !== 'user' && (
                                                <Image src={AVATAR_URL} alt="AI" width={28} height={28} className="mt-1 h-7 w-7 shrink-0 rounded-full object-cover" />
                                            )}
                                            <div
                                                className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                                    msg.role === 'user'
                                                        ? 'text-white'
                                                        : msg.role === 'system'
                                                          ? 'text-[#A7ADBE]'
                                                          : 'text-[#E0E4ED]'
                                                }`}
                                                style={
                                                    msg.role === 'user'
                                                        ? {
                                                              background: 'linear-gradient(134deg, #6A25E0 0%, #390CA4 100%)',
                                                          }
                                                        : msg.role === 'system'
                                                          ? {
                                                                background: '#0F1423',
                                                                border: '1px solid rgba(51, 102, 255, 0.15)',
                                                            }
                                                          : {
                                                                background: '#161C44',
                                                            }
                                                }
                                            >
                                                {msg.text}
                                            </div>
                                            {msg.role === 'user' && (
                                                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#161C44]">
                                                    <User className="h-4 w-4 text-[#A7ADBE]" />
                                                </div>
                                            )}
                                        </div>

                                        {/* AI-decided action buttons */}
                                        {msg.action && msg.action !== 'continue' && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.15, duration: 0.2 }}
                                                className="flex gap-2 mt-2 ml-9"
                                            >
                                                {msg.action === 'create_ticket' && (
                                                    <button
                                                        onClick={handleCreateTicket}
                                                        disabled={isLoading}
                                                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-all hover:brightness-125 disabled:opacity-50"
                                                        style={{
                                                            background: 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)',
                                                        }}
                                                    >
                                                        <Ticket className="h-3.5 w-3.5" />
                                                        Create Support Ticket
                                                    </button>
                                                )}
                                                {msg.action === 'connect_live_support' && (
                                                    <button
                                                        onClick={handleConnectLive}
                                                        disabled={isLoading}
                                                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-all hover:brightness-125 disabled:opacity-50"
                                                        style={{
                                                            background: 'linear-gradient(135deg, #3366FF 0%, #1A4FFF 100%)',
                                                        }}
                                                    >
                                                        <Headphones className="h-3.5 w-3.5" />
                                                        Connect to Live Support
                                                    </button>
                                                )}
                                                {msg.action === 'book_consultation' && (
                                                    <div
                                                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white"
                                                        style={{
                                                            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                                        }}
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

                            {/* Typing indicator */}
                            <AnimatePresence>
                                {isLoading && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 8 }}
                                        className="flex gap-2"
                                    >
                                        <Image src={AVATAR_URL} alt="AI" width={28} height={28} className="mt-1 h-7 w-7 shrink-0 rounded-full object-cover" />
                                        <div className="rounded-2xl px-4 py-3" style={{ background: '#161C44' }}>
                                            <TypingIndicator />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div
                            className="px-3 py-3 shrink-0"
                            style={{ borderTop: '1px solid rgba(51, 102, 255, 0.15)', background: '#0A0E1A' }}
                        >
                            <div
                                className="flex items-end gap-2 rounded-xl px-3 py-2"
                                style={{
                                    background: '#161C44',
                                    border: '1px solid rgba(51, 102, 255, 0.2)',
                                }}
                            >
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage();
                                        }
                                    }}
                                    placeholder="Type a message..."
                                    disabled={isLoading}
                                    rows={1}
                                    className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-[#A7ADBE]/50 focus:outline-none disabled:opacity-50"
                                    style={{
                                        maxHeight: '100px',
                                        overflowY: 'auto',
                                    }}
                                />
                                <button
                                    onClick={(e) => { e.preventDefault(); sendMessage(); }}
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
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
