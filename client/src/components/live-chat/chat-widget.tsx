'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useSupportSocket } from '../../hooks/useSupportSocket';
import { useSupportStore } from '../../store/useSupportStore';
import { useS3Upload } from '../../hooks/useS3Upload';
import { useSession } from '@/lib/auth-client';
import {
    MessageSquare,
    X,
    Send,
    Paperclip,
    Loader2,
    Check,
    CheckCheck,
    AlertCircle,
    User,
    Mail,
    Lock,
    Headset,
    WifiOff,
    CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { SoundToggle, TypingIndicator, AttachmentPreview, formatBytes } from '../support/support-elements';

export function ChatWidget() {
    const pathname = usePathname();
    if (pathname?.startsWith('/dashboard/support')) return null;

    const { data: session } = useSession();
    const {
        token,
        guestEmail,
        activeSession,
        messages,
        typingUsers,
        queuePosition,
        soundEnabled,
        setToken,
        setGuestEmail,
        setActiveSession,
        setMessages,
        addMessage,
        resetSupport,
    } = useSupportStore();

    const { isConnected, sendMessage, triggerTyping, joinChat } = useSupportSocket();
    const { isUploading, uploadProgress, uploadFile } = useS3Upload();

    const [isOpen, setIsOpen] = useState(false);
    
    // Auth & OTP states
    const [authStep, setAuthStep] = useState<'login' | 'otp' | 'chat'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    // Chat interface states
    const [inputMessage, setInputMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadingFileNames, setUploadingFileNames] = useState<string[]>([]);
    const [isCreatingSession, setIsCreatingSession] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom of conversation
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, typingUsers]);

    // Resend email OTP counter
    useEffect(() => {
        if (resendTimer > 0) {
            const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
            return () => clearInterval(interval);
        }
    }, [resendTimer]);

    // Track active connection auth step
    useEffect(() => {
        const isAuthenticated = session?.user !== undefined || token !== null;
        if (isAuthenticated) {
            setAuthStep('chat');
            // If active session is cached, rejoin immediately
            if (activeSession?.sessionId) {
                joinChat(activeSession.sessionId);
            }
        } else {
            setAuthStep('login');
        }
    }, [session, token, activeSession, joinChat]);

    // OTP request flow
    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !name.trim()) return;

        setAuthLoading(true);
        try {
            const response = await fetch('/api/support/guest/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name }),
            });

            if (!response.ok) {
                throw new Error('Failed to request OTP. Please try again.');
            }

            setGuestEmail(email);
            setAuthStep('otp');
            setResendTimer(60);
            toast.success('A 6-digit verification code has been sent to your email.');
        } catch (err: any) {
            toast.error(err.message || 'Verification connection failed.');
        } finally {
            setAuthLoading(false);
        }
    };

    // OTP verification flow
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp.trim()) return;

        setAuthLoading(true);
        try {
            const response = await fetch('/api/support/guest/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: guestEmail, otp }),
            });

            if (!response.ok) {
                throw new Error('Invalid verification code.');
            }

            const { data } = await response.json();
            setToken(data.token);
            setAuthStep('chat');
            toast.success('Email verified successfully! Welcome to Support.');
        } catch (err: any) {
            toast.error(err.message || 'OTP verification failed.');
        } finally {
            setAuthLoading(false);
        }
    };

    // Start Live Support Chat session
    const handleStartChat = async () => {
        setIsCreatingSession(true);
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch('/api/support/chat/sessions', {
                method: 'POST',
                headers,
            });

            if (!response.ok) {
                throw new Error('Unable to establish support session.');
            }

            const { data } = await response.json();
            setActiveSession(data);
            joinChat(data.sessionId);
            setMessages([]); // reset messages list
            toast.success('Live chat requested! Waiting for agents...');
        } catch (err: any) {
            toast.error(err.message || 'Support session failed.');
        } finally {
            setIsCreatingSession(false);
        }
    };

    // Attachment uploading handler
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        setSelectedFiles((prev) => [...prev, ...fileArray]);
    };

    const handleRemoveSelectedFile = (idx: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    // Send Message flow
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() && selectedFiles.length === 0) return;

        let uploadedAttachments: any[] = [];

        if (selectedFiles.length > 0) {
            try {
                // Upload files sequentially
                for (const file of selectedFiles) {
                    setUploadingFileNames((prev) => [...prev, file.name]);
                    const uploadResult = await uploadFile(file, activeSession?.sessionId);
                    uploadedAttachments.push(uploadResult);
                    setUploadingFileNames((prev) => prev.filter((name) => name !== file.name));
                }
            } catch (err) {
                toast.error('Some files failed to upload to storage.');
                setUploadingFileNames([]);
                return;
            }
        }

        // Emit through socket
        sendMessage(inputMessage, uploadedAttachments);
        
        // Optimistic update client list
        addMessage({
            sessionId: activeSession?.sessionId || '',
            sender: session?.user?.id || 'guest',
            senderModel: session?.user ? 'User' : 'Guest',
            senderName: session?.user?.name || name || 'Guest User',
            content: inputMessage,
            attachments: uploadedAttachments,
            createdAt: new Date().toISOString(),
        });

        setInputMessage('');
        setSelectedFiles([]);
    };

    // Close conversation session
    const handleCloseChat = async () => {
        if (!activeSession) return;
        if (!confirm('Are you sure you want to end this live support session?')) return;

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            await fetch(`/api/support/chat/sessions/${activeSession.sessionId}/close`, {
                method: 'POST',
                headers,
            });

            resetSupport();
            setAuthStep('chat');
        } catch (err) {
            toast.error('Failed to close session.');
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Realtime Chat Window Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 35, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 35, scale: 0.95 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="w-[370px] sm:w-[400px] h-[550px] bg-background/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col mb-4 select-none"
                    >
                        {/* WIDGET HEADER */}
                        <div className="bg-primary/95 dark:bg-primary/90 text-primary-foreground px-4 py-3 flex items-center justify-between shadow-md">
                            <div className="flex items-center gap-2">
                                <Headset className="w-5 h-5 animate-pulse" />
                                <div>
                                    <h3 className="text-xs font-bold leading-tight">Dev-HR Live Support</h3>
                                    <p className="text-[10px] text-primary-foreground/75 flex items-center gap-1">
                                        {isConnected ? (
                                            <>
                                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />
                                                Agent Live Chat Connected
                                            </>
                                        ) : (
                                            <>
                                                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full inline-block" />
                                                Offline (Connecting...)
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <SoundToggle />
                                {activeSession && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleCloseChat}
                                        className="w-8 h-8 rounded-full hover:bg-rose-500/20 text-primary-foreground hover:text-rose-400"
                                        title="End Support Chat Session"
                                    >
                                        <CheckSquare className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsOpen(false)}
                                    className="w-8 h-8 rounded-full hover:bg-primary-foreground/15 text-primary-foreground hover:text-white"
                                >
                                    <X className="w-4.5 h-4.5" />
                                </Button>
                            </div>
                        </div>

                        {/* WIDGET NETWORK DISCONNECT BAR */}
                        {!isConnected && (
                            <div className="bg-amber-500/10 dark:bg-amber-400/5 text-amber-600 dark:text-amber-400 text-[10px] py-1 px-3 border-b border-amber-500/20 flex items-center gap-1.5">
                                <WifiOff className="w-3.5 h-3.5" />
                                <span>Network connection lost. Attempting to auto-reconnect...</span>
                            </div>
                        )}

                        {/* WIDGET PANEL CONTENT */}
                        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/40 dark:bg-slate-950/20">
                            {/* STEP 1: GUEST DETAILS CAPTURE */}
                            {authStep === 'login' && (
                                <div className="flex-1 flex flex-col justify-center px-6 py-4 space-y-4">
                                    <div className="text-center space-y-1.5">
                                        <h4 className="text-sm font-bold text-foreground">Welcome to Dev-HR Support</h4>
                                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                                            Verify your identity to connect to live support agents and avoid chat spam.
                                        </p>
                                    </div>
                                    <form onSubmit={handleRequestOtp} className="space-y-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="guestName" className="text-[10px] font-semibold">Your Full Name</Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                                                <Input
                                                    id="guestName"
                                                    placeholder="John Doe"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    className="pl-9 text-xs"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="guestEmail" className="text-[10px] font-semibold">Your Email Address</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                                                <Input
                                                    id="guestEmail"
                                                    type="email"
                                                    placeholder="john@example.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="pl-9 text-xs"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            type="submit"
                                            disabled={authLoading || !email || !name}
                                            className="w-full text-xs cursor-pointer mt-2"
                                        >
                                            {authLoading ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                                    Sending OTP Code...
                                                </>
                                            ) : (
                                                'Send Verification OTP'
                                            )}
                                        </Button>
                                    </form>
                                </div>
                            )}

                            {/* STEP 2: GUEST OTP CODE VERIFICATION */}
                            {authStep === 'otp' && (
                                <div className="flex-1 flex flex-col justify-center px-6 py-4 space-y-4">
                                    <div className="text-center space-y-1.5">
                                        <h4 className="text-sm font-bold text-foreground">Verify Your Email</h4>
                                        <p className="text-xs text-muted-foreground">
                                            We sent a code to <span className="font-semibold">{guestEmail}</span>. Enter it below.
                                        </p>
                                    </div>
                                    <form onSubmit={handleVerifyOtp} className="space-y-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="guestOtp" className="text-[10px] font-semibold">6-Digit Code</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                                                <Input
                                                    id="guestOtp"
                                                    placeholder="123456"
                                                    maxLength={6}
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value)}
                                                    className="pl-9 text-xs tracking-widest font-bold"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            type="submit"
                                            disabled={authLoading || otp.length < 6}
                                            className="w-full text-xs cursor-pointer"
                                        >
                                            {authLoading ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                                    Verifying...
                                                </>
                                            ) : (
                                                'Verify & Connect'
                                            )}
                                        </Button>
                                        <div className="text-center">
                                            {resendTimer > 0 ? (
                                                <p className="text-[10px] text-muted-foreground">Resend code in {resendTimer}s</p>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleRequestOtp}
                                                    className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                                                >
                                                    Resend Code Email
                                                </button>
                                            )}
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* STEP 3: THE LIVE SUPPORT ROOMS */}
                            {authStep === 'chat' && (
                                <div className="flex-1 flex flex-col min-h-0">
                                    {/* Sub-State A: Connect to Session Splash Screen */}
                                    {!activeSession ? (
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                                            <div className="p-4 rounded-full bg-primary/10 border border-primary/20 text-primary">
                                                <MessageSquare className="w-8 h-8" />
                                            </div>
                                            <div className="space-y-1.5 max-w-xs">
                                                <h4 className="text-sm font-bold text-foreground">Need Immediate Help?</h4>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    Start a live conversation with our Support operations team. We are online and ready to assist you.
                                                </p>
                                            </div>
                                            <Button
                                                onClick={handleStartChat}
                                                disabled={isCreatingSession}
                                                className="px-6 text-xs cursor-pointer gap-1.5"
                                            >
                                                {isCreatingSession ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Connecting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-3.5 h-3.5" />
                                                        Start Live Chat
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    ) : (
                                        // Sub-State B: Session Established & Connected
                                        <div className="flex-1 flex flex-col min-h-0">
                                            {/* QUEUE POSITION WARNING */}
                                            {activeSession.status === 'queued' && (
                                                <div className="bg-primary/5 border-b border-primary/10 px-4 py-3 flex items-center gap-3">
                                                    <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <h5 className="text-[11px] font-bold text-foreground">Waiting in Queue Queue...</h5>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                                                            Position: <span className="font-semibold text-primary">#{queuePosition || 1}</span>. An agent will claim this conversation. If no agent claims in 10 mins, it auto-converts to a ticket!
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* MESSAGE TIMELINE LIST */}
                                            <ScrollArea className="flex-1 p-4 min-h-0">
                                                <div className="space-y-3.5 pr-2">
                                                    {messages.length === 0 && (
                                                        <div className="text-center py-6 text-muted-foreground text-[10px]">
                                                            Connection opened. Say hello to get started.
                                                        </div>
                                                    )}
                                                    {messages.map((msg, idx) => {
                                                        const currentUserId = session?.user?.id || 'guest';
                                                        const isSelf = msg.sender === currentUserId;
                                                        const seen = msg.seenBy && msg.seenBy.length > 0;

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`flex flex-col ${
                                                                    isSelf ? 'items-end' : 'items-start'
                                                                }`}
                                                            >
                                                                <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
                                                                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                                                        {isSelf ? 'You' : msg.senderName}
                                                                    </span>
                                                                    <span className="text-[8px] text-muted-foreground">
                                                                        {new Date(msg.createdAt).toLocaleTimeString([], {
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                
                                                                {/* Message Bubble Container */}
                                                                <div
                                                                    className={`px-3.5 py-2 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                                                                        isSelf
                                                                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                                            : 'bg-muted text-foreground rounded-tl-none border'
                                                                    }`}
                                                                >
                                                                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                                                    
                                                                    {/* Render S3 Attachments */}
                                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                                        <div className="space-y-1.5 mt-2 pt-1.5 border-t border-white/10">
                                                                            {msg.attachments.map((file, fIdx) => (
                                                                                <a
                                                                                    key={fIdx}
                                                                                    href={file.url}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="flex items-center gap-1.5 text-[10px] hover:underline"
                                                                                >
                                                                                    <Paperclip className="w-3 h-3 shrink-0" />
                                                                                    <span className="truncate max-w-[200px]">{file.fileName}</span>
                                                                                    <span className="text-[8px] opacity-75">({formatBytes(file.fileSize)})</span>
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                {/* Read receipts */}
                                                                {isSelf && (
                                                                    <div className="text-[9px] text-muted-foreground mt-0.5 flex items-center gap-0.5 mr-1">
                                                                        {seen ? (
                                                                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                                                                        ) : (
                                                                            <Check className="w-3.5 h-3.5 text-muted-foreground" />
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Real-time typing indicators */}
                                                    {Object.entries(typingUsers).map(([userId, user]) => {
                                                        const currentUserId = session?.user?.id || 'guest';
                                                        if (userId === currentUserId || !user.isTyping) return null;
                                                        return (
                                                            <div key={userId} className="flex flex-col items-start">
                                                                <TypingIndicator label={`${user.name} is typing...`} />
                                                            </div>
                                                        );
                                                    })}
                                                    <div ref={messagesEndRef} />
                                                </div>
                                            </ScrollArea>

                                            {/* CHAT PANEL FOOTER INPUT EDITOR */}
                                            <div className="p-3 border-t bg-background/50 flex flex-col gap-2 shrink-0">
                                                {/* Uploading progress bars */}
                                                {isUploading && (
                                                    <div className="p-2 border rounded-lg bg-card/65 space-y-1.5">
                                                        <div className="flex items-center gap-1 text-[10px] text-foreground font-semibold">
                                                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                                            <span>Uploading media files directly to S3...</span>
                                                        </div>
                                                        {Object.entries(uploadProgress).map(([name, progress]) => (
                                                            <Progress key={name} value={progress} className="h-1" />
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Selected attachments list */}
                                                {selectedFiles.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                                                        {selectedFiles.map((file, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full text-[10px] border shrink-0 max-w-xs"
                                                            >
                                                                <span className="truncate">{file.name}</span>
                                                                <button
                                                                    onClick={() => handleRemoveSelectedFile(idx)}
                                                                    className="text-rose-500 hover:text-rose-600 ml-1 p-0.5 rounded-full"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Inputs toolbar */}
                                                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
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
                                                        size="icon"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={isUploading || isCreatingSession}
                                                        className="w-8 h-8 rounded-full shrink-0 border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                                    >
                                                        <Paperclip className="w-4 h-4" />
                                                    </Button>
                                                    <Input
                                                        placeholder="Write a message..."
                                                        value={inputMessage}
                                                        onChange={(e) => {
                                                            setInputMessage(e.target.value);
                                                            triggerTyping();
                                                        }}
                                                        disabled={isCreatingSession}
                                                        className="h-8 text-xs flex-1 rounded-full px-3.5 border-border bg-card/65 focus-visible:ring-primary focus-visible:ring-1"
                                                    />
                                                    <Button
                                                        type="submit"
                                                        size="icon"
                                                        disabled={!inputMessage.trim() && selectedFiles.length === 0}
                                                        className="w-8 h-8 rounded-full shrink-0 cursor-pointer"
                                                    >
                                                        <Send className="w-3.5 h-3.5" />
                                                    </Button>
                                                </form>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FLOATING ACTION LAUNCHER BUBBLE */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl border cursor-pointer select-none transition-all ${
                    isOpen
                        ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-600/20'
                        : 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary/20 ring-4 ring-primary/10'
                }`}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.span
                            key="close"
                            initial={{ rotate: -45, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 45, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <X className="w-6 h-6" />
                        </motion.span>
                    ) : (
                        <motion.span
                            key="open"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="relative"
                        >
                            <MessageSquare className="w-6 h-6" />
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
}
export default ChatWidget;
