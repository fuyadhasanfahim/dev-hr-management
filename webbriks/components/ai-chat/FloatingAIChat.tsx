'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, User, Loader2, Ticket, Headphones, RotateCcw } from 'lucide-react';
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
    action?: 'continue' | 'create_ticket' | 'connect_live_support';
    actionReason?: string;
}

export function FloatingAIChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showActions, setShowActions] = useState<'create_ticket' | 'connect_live_support' | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
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
        setShowActions(null);
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
        setShowActions(null);

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

            if (action === 'create_ticket' || action === 'connect_live_support') {
                setShowActions(action);
            }
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
        }
    }

    async function handleCreateTicket() {
        setIsLoading(true);
        setShowActions(null);

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
        setShowActions(null);

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
            {!isOpen && (
                <button
                    onClick={openChat}
                    className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
                    style={{
                        background: 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)',
                        boxShadow: '0 0 24px 0 rgba(106, 37, 224, 0.5)',
                    }}
                    aria-label="Open AI Chat"
                >
                    <MessageCircle className="h-6 w-6 text-white" />
                </button>
            )}

            {/* Chat panel */}
            {isOpen && (
                <div
                    className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl shadow-2xl"
                    style={{
                        background: '#0A0E1A',
                        border: '1px solid rgba(51, 102, 255, 0.3)',
                        boxShadow: '0 0 40px 0 rgba(51, 102, 255, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-4 py-3"
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
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ background: '#060A14' }}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
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
                        ))}

                        {isLoading && (
                            <div className="flex gap-2">
                                <Image src={AVATAR_URL} alt="AI" width={28} height={28} className="mt-1 h-7 w-7 shrink-0 rounded-full object-cover" />
                                <div className="rounded-2xl px-3.5 py-2.5" style={{ background: '#161C44' }}>
                                    <Loader2 className="h-4 w-4 animate-spin text-[#A7ADBE]" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Action buttons */}
                    {showActions && (
                        <div className="flex gap-2 px-4 py-2" style={{ borderTop: '1px solid rgba(51, 102, 255, 0.15)', background: '#0A0E1A' }}>
                            {showActions === 'create_ticket' && (
                                <button
                                    onClick={handleCreateTicket}
                                    disabled={isLoading}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-all hover:brightness-125 disabled:opacity-50"
                                    style={{
                                        background: 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)',
                                    }}
                                >
                                    <Ticket className="h-3.5 w-3.5" />
                                    Create Support Ticket
                                </button>
                            )}
                            {showActions === 'connect_live_support' && (
                                <button
                                    onClick={handleConnectLive}
                                    disabled={isLoading}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-all hover:brightness-125 disabled:opacity-50"
                                    style={{
                                        background: 'linear-gradient(135deg, #3366FF 0%, #1A4FFF 100%)',
                                    }}
                                >
                                    <Headphones className="h-3.5 w-3.5" />
                                    Connect to Live Support
                                </button>
                            )}
                        </div>
                    )}

                    {/* Quick actions (always visible) */}
                    {!showActions && messages.length > 1 && (
                        <div className="flex gap-2 px-4 py-2" style={{ borderTop: '1px solid rgba(51, 102, 255, 0.15)', background: '#0A0E1A' }}>
                            <button
                                onClick={handleCreateTicket}
                                disabled={isLoading}
                                className="flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#A7ADBE] transition-colors hover:text-white hover:bg-[#161C44] disabled:opacity-50"
                                style={{ border: '1px solid rgba(51, 102, 255, 0.2)' }}
                            >
                                <Ticket className="h-3 w-3" />
                                Create Ticket
                            </button>
                            <button
                                onClick={handleConnectLive}
                                disabled={isLoading}
                                className="flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#A7ADBE] transition-colors hover:text-white hover:bg-[#161C44] disabled:opacity-50"
                                style={{ border: '1px solid rgba(51, 102, 255, 0.2)' }}
                            >
                                <Headphones className="h-3 w-3" />
                                Live Support
                            </button>
                        </div>
                    )}

                    {/* Input */}
                    <form
                        onSubmit={sendMessage}
                        className="flex items-center gap-2 px-3 py-3"
                        style={{ borderTop: '1px solid rgba(51, 102, 255, 0.15)', background: '#0A0E1A' }}
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            disabled={isLoading}
                            className="flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#A7ADBE]/50 focus:outline-none disabled:opacity-50"
                            style={{
                                background: '#161C44',
                                border: '1px solid rgba(51, 102, 255, 0.2)',
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-all hover:brightness-125 disabled:opacity-50"
                            style={{
                                background: 'linear-gradient(134deg, #9C46F4 1.15%, #6A25E0 17.12%, #390CA4 47.7%, #28048B 71.73%)',
                            }}
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
