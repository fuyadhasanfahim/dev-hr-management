'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Ticket, Headphones, RotateCcw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';

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
                    className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 active:scale-95"
                    aria-label="Open AI Chat"
                >
                    <MessageCircle className="h-6 w-6" />
                </button>
            )}

            {/* Chat panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary-foreground" />
                            <div>
                                <h3 className="text-sm font-semibold text-primary-foreground">
                                    Web Briks AI Assistant
                                </h3>
                                <p className="text-xs text-primary-foreground/70">
                                    Ask me anything about our services
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={resetChat}
                                className="rounded-full p-1.5 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                                title="Reset conversation"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="rounded-full p-1.5 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex gap-2 ${
                                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                                }`}
                            >
                                {msg.role !== 'user' && (
                                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                        <Bot className="h-4 w-4 text-primary" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : msg.role === 'system'
                                              ? 'bg-muted/80 text-muted-foreground border border-border'
                                              : 'bg-muted text-foreground'
                                    }`}
                                >
                                    {msg.text}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex gap-2">
                                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                    <Bot className="h-4 w-4 text-primary" />
                                </div>
                                <div className="rounded-2xl bg-muted px-3.5 py-2.5">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Action buttons */}
                    {showActions && (
                        <div className="flex gap-2 border-t border-border px-4 py-2">
                            {showActions === 'create_ticket' && (
                                <button
                                    onClick={handleCreateTicket}
                                    disabled={isLoading}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                                >
                                    <Ticket className="h-3.5 w-3.5" />
                                    Create Support Ticket
                                </button>
                            )}
                            {showActions === 'connect_live_support' && (
                                <button
                                    onClick={handleConnectLive}
                                    disabled={isLoading}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
                                >
                                    <Headphones className="h-3.5 w-3.5" />
                                    Connect to Live Support
                                </button>
                            )}
                        </div>
                    )}

                    {/* Quick actions (always visible) */}
                    {!showActions && messages.length > 1 && (
                        <div className="flex gap-2 border-t border-border px-4 py-2">
                            <button
                                onClick={handleCreateTicket}
                                disabled={isLoading}
                                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                            >
                                <Ticket className="h-3 w-3" />
                                Create Ticket
                            </button>
                            <button
                                onClick={handleConnectLive}
                                disabled={isLoading}
                                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                            >
                                <Headphones className="h-3 w-3" />
                                Live Support
                            </button>
                        </div>
                    )}

                    {/* Input */}
                    <form
                        onSubmit={sendMessage}
                        className="flex items-center gap-2 border-t border-border px-3 py-3"
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            disabled={isLoading}
                            className="flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
