import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    MessageSquare,
    Ticket,
    Send,
    User,
    Mail,
    Lock,
    Headset,
    Wifi,
    WifiOff,
    Terminal,
    Settings,
    Info,
    Clock,
    AlertCircle,
    Paperclip,
    X,
    ShieldCheck,
} from 'lucide-react';

interface ChatMessage {
    _id?: string;
    messageId?: string;
    sessionId: string;
    sender: string;
    senderModel: 'Client' | 'Guest' | 'User' | 'Staff';
    senderName: string;
    content: string;
    attachments?: any[];
    isInternal?: boolean;
    createdAt: string;
}

interface SupportTicket {
    _id: string;
    ticketId: string;
    subject: string;
    status: 'open' | 'in_progress' | 'pending_client' | 'closed';
    priority: 'low' | 'medium' | 'high';
    createdAt: string;
    updatedAt: string;
}

function App() {
    // Global connection settings
    const [apiBaseUrl, setApiBaseUrl] = useState(() => {
        return (
            localStorage.getItem('support_api_base') || 'http://localhost:5000'
        );
    });
    const [showSettings, setShowSettings] = useState(false);
    const [showEnvGuide, setShowEnvGuide] = useState(true);

    // Authentication & Guest states
    const [authToken, setAuthToken] = useState(
        () => localStorage.getItem('support_token') || '',
    );
    const [guestName, setGuestName] = useState(
        () => localStorage.getItem('support_name') || '',
    );
    const [guestEmail, setGuestEmail] = useState(
        () => localStorage.getItem('support_email') || '',
    );
    const [authStep, setAuthStep] = useState<'register' | 'otp' | 'dashboard'>(
        localStorage.getItem('support_token') ? 'dashboard' : 'register',
    );

    const [otpCode, setOtpCode] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');

    // Dashboard views
    const [activeTab, setActiveTab] = useState<'chat' | 'tickets'>('chat');

    // Socket & Live Chat states
    const [socket, setSocket] = useState<Socket | null>(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [chatSession, setChatSession] = useState<any>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [typingStatus, setTypingStatus] = useState<{
        name: string;
        isTyping: boolean;
    } | null>(null);
    const [queuePosition, setQueuePosition] = useState<number | null>(null);
    const [activeAgent, setActiveAgent] = useState<any>(null);

    // Custom attachments state
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Support Tickets states
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [ticketMessages, setTicketMessages] = useState<any[]>([]);
    const [newTicketSubject, setNewTicketSubject] = useState('');
    const [newTicketText, setNewTicketText] = useState('');
    const [newTicketPriority, setNewTicketPriority] = useState<
        'low' | 'medium' | 'high'
    >('medium');
    const [ticketReplyText, setTicketReplyText] = useState('');
    const [ticketLoading, setTicketLoading] = useState(false);

    // System Diagnostics console logger
    const [systemLogs, setSystemLogs] = useState<
        { id: string; time: string; event: string; payload: any }[]
    >([]);

    // DOM Refs
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const logsBottomRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Save base URL changes
    const saveBaseUrl = (url: string) => {
        const formatted = url.trim().replace(/\/+$/, '');
        setApiBaseUrl(formatted);
        localStorage.setItem('support_api_base', formatted);
        logSystemEvent('Settings', 'Updated API base URL', { url: formatted });
    };

    // Log system diagnostic events
    const logSystemEvent = (event: string, msg: string, payload?: any) => {
        const time = new Date().toLocaleTimeString();
        setSystemLogs((prev) =>
            [
                ...prev,
                {
                    id: Math.random().toString(),
                    time,
                    event: `${event}: ${msg}`,
                    payload,
                },
            ].slice(-50),
        ); // Cap at 50 logs
    };

    // Scroll utilities
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, typingStatus]);

    useEffect(() => {
        logsBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [systemLogs]);

    // Request Guest OTP
    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!guestName || !guestEmail) return;
        setAuthLoading(true);
        setAuthError('');
        logSystemEvent('Auth', 'Requesting Guest OTP', {
            guestEmail,
            guestName,
        });

        try {
            const res = await fetch(`${apiBaseUrl}/api/support/guest/otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: guestEmail, name: guestName }),
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.message || 'Server error requesting OTP');

            logSystemEvent('Auth', 'OTP Code Sent Successfully', data);
            localStorage.setItem('support_name', guestName);
            localStorage.setItem('support_email', guestEmail);
            setAuthStep('otp');
        } catch (err: any) {
            setAuthError(err.message || 'Network connection failed.');
            logSystemEvent(
                'Auth Error',
                err.message || 'OTP request failed',
                err,
            );
        } finally {
            setAuthLoading(false);
        }
    };

    // Verify Guest OTP
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otpCode) return;
        setAuthLoading(true);
        setAuthError('');
        logSystemEvent('Auth', 'Verifying OTP code', { otpCode });

        try {
            const res = await fetch(`${apiBaseUrl}/api/support/guest/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: guestEmail, otp: otpCode }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Invalid OTP code');

            const token = data.data.token;
            logSystemEvent('Auth', 'OTP Verified & Token Received', {
                token: token.slice(0, 10) + '...',
            });
            localStorage.setItem('support_token', token);
            setAuthToken(token);
            setAuthStep('dashboard');
        } catch (err: any) {
            setAuthError(err.message || 'Verification failed.');
            logSystemEvent(
                'Auth Error',
                err.message || 'OTP verification failed',
                err,
            );
        } finally {
            setAuthLoading(false);
        }
    };

    // Developer Bypass Login
    const handleDevBypass = (customToken: string) => {
        if (!customToken) {
            setAuthError('Please enter a valid bypass token.');
            return;
        }
        logSystemEvent('Auth', 'Bypassing verification with custom token', {
            customToken: customToken.slice(0, 15) + '...',
        });
        localStorage.setItem('support_token', customToken);
        localStorage.setItem('support_name', 'Dev Tester');
        localStorage.setItem('support_email', 'dev@hr.local');
        setGuestName('Dev Tester');
        setGuestEmail('dev@hr.local');
        setAuthToken(customToken);
        setAuthStep('dashboard');
    };

    // Logout/Reset Auth session
    const handleLogout = () => {
        logSystemEvent('Auth', 'Logging out and resetting state');
        localStorage.removeItem('support_token');
        localStorage.removeItem('support_name');
        localStorage.removeItem('support_email');
        setAuthToken('');
        setGuestName('');
        setGuestEmail('');
        setAuthStep('register');
        if (socket) {
            socket.disconnect();
        }
        setSocketConnected(false);
        setChatSession(null);
        setChatMessages([]);
        setTickets([]);
        setSelectedTicket(null);
    };

    // Load support tickets list
    const loadTickets = async () => {
        if (!authToken) return;
        setTicketLoading(true);
        logSystemEvent('Tickets', 'Fetching guest support tickets');
        try {
            const res = await fetch(`${apiBaseUrl}/api/support/tickets`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.message || 'Failed to retrieve tickets');
            setTickets(data.data || []);
            logSystemEvent(
                'Tickets',
                `Loaded ${data.data?.length || 0} tickets`,
            );
        } catch (err: any) {
            logSystemEvent(
                'Tickets Error',
                err.message || 'Failed to load tickets',
                err,
            );
        } finally {
            setTicketLoading(false);
        }
    };

    // Load single ticket details + messages
    const loadTicketDetails = async (id: string) => {
        if (!authToken) return;
        logSystemEvent('Tickets', `Fetching details for ticket ID: ${id}`);
        try {
            const res = await fetch(`${apiBaseUrl}/api/support/tickets/${id}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.message || 'Failed to fetch details');

            setSelectedTicket(data.data.ticket);
            setTicketMessages(data.data.messages || []);
            logSystemEvent(
                'Tickets',
                'Loaded ticket details & messages thread',
                data.data,
            );
        } catch (err: any) {
            logSystemEvent(
                'Tickets Error',
                err.message || 'Failed to load ticket details',
                err,
            );
        }
    };

    // Submit new Support Ticket
    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTicketSubject || !newTicketText) return;
        setTicketLoading(true);
        logSystemEvent('Tickets', 'Creating new support ticket', {
            subject: newTicketSubject,
            priority: newTicketPriority,
        });

        try {
            const res = await fetch(`${apiBaseUrl}/api/support/tickets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    subject: newTicketSubject,
                    text: newTicketText,
                    priority: newTicketPriority,
                    attachments: [],
                }),
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(
                    data.message || 'Failed to submit support ticket',
                );

            logSystemEvent('Tickets', 'Ticket Created Successfully', data.data);
            setNewTicketSubject('');
            setNewTicketText('');
            loadTickets(); // Refresh list
        } catch (err: any) {
            logSystemEvent(
                'Tickets Error',
                err.message || 'Creation failed',
                err,
            );
        } finally {
            setTicketLoading(false);
        }
    };

    // Reply to ticket
    const handleReplyToTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ticketReplyText.trim() || !selectedTicket) return;
        logSystemEvent(
            'Tickets',
            `Submitting response reply to Ticket ${selectedTicket.ticketId}`,
        );

        try {
            const res = await fetch(
                `${apiBaseUrl}/api/support/tickets/${selectedTicket._id}/replies`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({
                        text: ticketReplyText,
                        attachments: [],
                    }),
                },
            );
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.message || 'Failed to send reply');

            logSystemEvent('Tickets', 'Reply added successfully', data.data);
            setTicketReplyText('');
            loadTicketDetails(selectedTicket._id); // Reload conversation thread
        } catch (err: any) {
            logSystemEvent('Tickets Error', err.message || 'Reply failed', err);
        }
    };

    // Socket IO initialization & setup
    useEffect(() => {
        if (authStep !== 'dashboard' || !authToken) return;

        logSystemEvent('Socket', 'Connecting to namespace /support', {
            endpoint: `${apiBaseUrl}/support`,
        });

        const newSocket = io(`${apiBaseUrl}/support`, {
            auth: { token: authToken },
            transports: ['websocket'],
            reconnectionDelay: 2000,
            reconnectionDelayMax: 5000,
        });

        // Register WebSocket Listeners
        newSocket.on('connect', () => {
            setSocketConnected(true);
            logSystemEvent('Socket', 'Connected to /support namespace', {
                socketId: newSocket.id,
            });
        });

        newSocket.on('disconnect', (reason) => {
            setSocketConnected(false);
            logSystemEvent('Socket', 'Disconnected', { reason });
        });

        newSocket.on('connect_error', (error) => {
            logSystemEvent(
                'Socket Error',
                'Handshake or transport connection failed',
                { error: error.message },
            );
        });

        // Support events
        newSocket.on(
            'chat:joined',
            (data: { session: any; messages: ChatMessage[] }) => {
                setChatSession(data.session);
                setChatMessages(data.messages || []);
                if (data.session.assignedAgent) {
                    setActiveAgent(data.session.assignedAgent);
                }
                logSystemEvent('Socket Event', 'chat:joined received', data);
            },
        );

        newSocket.on('chat:message', (message: ChatMessage) => {
            setChatMessages((prev) => {
                // Avoid duplicate optimistic messages
                if (
                    prev.some(
                        (m) =>
                            m._id === message._id ||
                            (m.messageId && m.messageId === message.messageId),
                    )
                ) {
                    return prev;
                }
                return [...prev, message];
            });
            logSystemEvent('Socket Event', 'chat:message received', message);

            // Auto emit seen event
            if (message.sender !== 'guest' && chatSession) {
                newSocket.emit('chat:seen', {
                    sessionId: chatSession.sessionId,
                    messageId: message._id || message.messageId,
                });
                logSystemEvent(
                    'Socket Emit',
                    'chat:seen emitted for messageId',
                    message._id || message.messageId,
                );
            }
        });

        newSocket.on(
            'chat:agent_joined',
            (data: { agentId: string; agentName: string }) => {
                setActiveAgent({ name: data.agentName, id: data.agentId });
                logSystemEvent('Socket Event', 'chat:agent_joined', data);
            },
        );

        newSocket.on('chat:agent_assigned', (data: { session: any }) => {
            setChatSession(data.session);
            if (data.session.assignedAgent) {
                setActiveAgent(data.session.assignedAgent);
            }
            logSystemEvent('Socket Event', 'chat:agent_assigned', data);
        });

        newSocket.on(
            'chat:typing',
            (data: { userId: string; userName: string; isTyping: boolean }) => {
                if (data.isTyping) {
                    setTypingStatus({ name: data.userName, isTyping: true });
                } else {
                    setTypingStatus(null);
                }
                logSystemEvent('Socket Event', 'chat:typing received', data);
            },
        );

        newSocket.on('chat:seen', (data: { messageId: string }) => {
            setChatMessages((prev) =>
                prev.map((m) => {
                    if (
                        m._id === data.messageId ||
                        m.messageId === data.messageId
                    ) {
                        return { ...m, seenBy: ['agent'] }; // Mark seen visually
                    }
                    return m;
                }),
            );
            logSystemEvent('Socket Event', 'chat:seen received', data);
        });

        newSocket.on(
            'chat:closed',
            (data: { sessionId: string; endedBy: string }) => {
                logSystemEvent(
                    'Socket Event',
                    'chat:closed received - Support Chat Session Resolved',
                    data,
                );
                setChatSession(null);
                setChatMessages([]);
                setActiveAgent(null);
            },
        );

        newSocket.on(
            'queue:update',
            (data: { position: number; onlineAgents: number }) => {
                setQueuePosition(data.position);
                logSystemEvent('Socket Event', 'queue:update received', data);
            },
        );

        newSocket.on('error', (err: any) => {
            logSystemEvent(
                'Socket Error Event',
                err.message || 'Generic error event',
                err,
            );
        });

        setSocket(newSocket);

        // Load support tickets initially
        loadTickets();

        return () => {
            newSocket.disconnect();
            logSystemEvent('Socket', 'Cleaned up connection context');
        };
    }, [authStep, authToken, apiBaseUrl]);

    // Start a support live chat session
    const handleStartLiveChat = async () => {
        logSystemEvent(
            'API',
            'Initiating live support chat session via POST /api/support/chats/session',
        );
        try {
            const res = await fetch(`${apiBaseUrl}/api/support/chats/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(
                    data.message || 'Failed to establish support session',
                );

            logSystemEvent(
                'API',
                'Live Support Chat Session Created',
                data.data,
            );
            setChatSession(data.data);

            // Emit join event via socket
            if (socket && socket.connected) {
                socket.emit('chat:join', { sessionId: data.data.sessionId });
                logSystemEvent(
                    'Socket Emit',
                    'chat:join emitted for session ID',
                    data.data.sessionId,
                );
            }
        } catch (err: any) {
            logSystemEvent(
                'API Error',
                err.message || 'Start chat request failed',
                err,
            );
        }
    };

    // Close support chat session
    const handleCloseChat = async () => {
        if (!chatSession) return;
        logSystemEvent(
            'Socket Emit',
            'chat:close emitted for session ID',
            chatSession.sessionId,
        );
        if (socket && socket.connected) {
            socket.emit('chat:close', { sessionId: chatSession.sessionId });
        }
    };

    // Mock File Upload (gracefully simulated if S3 key triggers fail)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        logSystemEvent(
            'S3 Upload',
            'Initiating attachment file upload directly to S3 bucket',
            { fileName: file.name, fileSize: file.size },
        );
        setUploadProgress(10);

        try {
            // 1. Ask API for S3 pre-signed upload URL
            const presignedRes = await fetch(
                `${apiBaseUrl}/api/support/attachments/presigned-url`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        folder: 'chats',
                        referenceId: chatSession?.sessionId || 'test-reference',
                    }),
                },
            );

            if (!presignedRes.ok) {
                throw new Error(
                    'Pre-signed URL request rejected by API server (is AWS configured?)',
                );
            }

            const { data } = await presignedRes.json();
            const { uploadUrl, fileUrl, fileKey } = data;

            logSystemEvent(
                'S3 Presigned',
                'Received presigned upload URL from server',
                { uploadUrl: uploadUrl.slice(0, 50) + '...', fileUrl },
            );
            setUploadProgress(50);

            // 2. Perform direct browser-to-S3 upload
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file,
            });

            if (!uploadRes.ok) {
                throw new Error(
                    `S3 PUT request failed with status: ${uploadRes.status}`,
                );
            }

            logSystemEvent('S3 Success', 'Direct S3 upload successful!', {
                fileUrl,
                fileKey,
            });
            setSelectedFiles((prev) => [...prev, file]);
            setUploadProgress(100);

            // Auto clear progress bar after 2s
            setTimeout(() => setUploadProgress(null), 2000);
        } catch (err: any) {
            logSystemEvent(
                'S3 Upload Failure',
                err.message ||
                    'Upload operation failed. Simulating local mock fallback instead.',
                err,
            );

            // FALLBACK MOCK SIMULATOR FOR DEV CONSOLE
            setUploadProgress(40);
            setTimeout(() => {
                setUploadProgress(80);
                setTimeout(() => {
                    setSelectedFiles((prev) => [...prev, file]);
                    setUploadProgress(null);
                    logSystemEvent(
                        'Mock S3',
                        'Attachment simulated and attached locally (Mock S3 Fallback)',
                        {
                            fileName: file.name,
                            fileUrl:
                                'https://dummy-aws-bucket.s3.amazonaws.com/chats/mock/' +
                                file.name,
                        },
                    );
                }, 600);
            }, 600);
        }
    };

    // Send message over WebSocket
    const handleSendChatMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() && selectedFiles.length === 0) return;
        if (!chatSession || !socket || !socket.connected) {
            logSystemEvent(
                'Chat Error',
                'Cannot send message: Socket is offline or session not active',
            );
            return;
        }

        const attachments = selectedFiles.map((f) => ({
            fileName: f.name,
            fileSize: f.size,
            fileType: f.type,
            url:
                'https://dummy-aws-bucket.s3.amazonaws.com/chats/mock/' +
                f.name,
        }));

        const textPayload = chatInput.trim();

        // Emitting chat message
        // Support both 'text' and 'content' properties to handle any server-side structure
        const payload = {
            sessionId: chatSession.sessionId,
            text: textPayload,
            content: textPayload,
            attachments: attachments,
        };

        socket.emit('chat:message', payload);
        logSystemEvent('Socket Emit', 'chat:message emitted', payload);

        // Optimistically update message bubble stream
        const optimisticMsg: ChatMessage = {
            sessionId: chatSession.sessionId,
            sender: 'guest',
            senderModel: 'Guest',
            senderName: guestName || 'Guest User',
            content: textPayload,
            attachments: attachments,
            createdAt: new Date().toISOString(),
        };

        setChatMessages((prev) => [...prev, optimisticMsg]);

        setChatInput('');
        setSelectedFiles([]);
    };

    // Typing event trigger
    const typingTimeoutRef = useRef<any>(null);
    const handleTypingEvent = () => {
        if (!socket || !socket.connected || !chatSession) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        } else {
            socket.emit('chat:typing', {
                sessionId: chatSession.sessionId,
                isTyping: true,
            });
            logSystemEvent('Socket Emit', 'chat:typing (true) emitted');
        }

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('chat:typing', {
                sessionId: chatSession.sessionId,
                isTyping: false,
            });
            logSystemEvent('Socket Emit', 'chat:typing (false) emitted');
            typingTimeoutRef.current = null;
        }, 1500);
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
            }}
        >
            {/* premium glass header */}
            <header
                className="app-header glass-panel"
                style={{ borderRadius: '0 0 16px 16px', borderTop: 'none' }}
            >
                <div className="logo-container">
                    <div className="pulse-indicator" />
                    <Headset
                        size={22}
                        style={{ color: 'var(--color-primary)' }}
                    />
                    <h2
                        style={{
                            fontSize: '18px',
                            margin: 0,
                            fontWeight: 700,
                            letterSpacing: '-0.3px',
                        }}
                    >
                        HR Live Support & Ticket Diagnostics
                    </h2>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                    }}
                >
                    {socketConnected ? (
                        <span
                            className="badge badge-emerald"
                            style={{ gap: '6px' }}
                        >
                            <Wifi size={13} /> Active WS Gateway Online
                        </span>
                    ) : (
                        <span
                            className="badge badge-rose"
                            style={{ gap: '6px' }}
                        >
                            <WifiOff size={13} /> WS Gateway Offline
                        </span>
                    )}

                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="btn-secondary"
                        style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                        }}
                    >
                        <Settings size={14} /> Settings
                    </button>

                    {authStep === 'dashboard' && (
                        <button
                            onClick={handleLogout}
                            className="btn-danger"
                            style={{ padding: '8px 12px', fontSize: '12px' }}
                        >
                            Sign Out Session
                        </button>
                    )}
                </div>
            </header>

            {/* Main Settings Panel */}
            {showSettings && (
                <div
                    className="glass-panel"
                    style={{
                        margin: '16px 40px 0',
                        padding: '20px',
                        borderRadius: '12px',
                    }}
                >
                    <h3
                        style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            marginBottom: '12px',
                        }}
                    >
                        API Config Settings
                    </h3>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxWidth: '400px',
                        }}
                    >
                        <label
                            style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                            }}
                        >
                            Backend base URL (Express Server Port)
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                value={apiBaseUrl}
                                onChange={(e) => saveBaseUrl(e.target.value)}
                                className="premium-input"
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    fontSize: '13px',
                                }}
                            />
                            <button
                                onClick={() => setShowSettings(false)}
                                className="btn-primary"
                                style={{ padding: '8px 16px' }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* S3 Environment variables help guide */}
            {showEnvGuide && (
                <div
                    className="glass-panel"
                    style={{
                        margin: '16px 40px 0',
                        padding: '20px',
                        borderRadius: '12px',
                        background: 'rgba(99,102,241,0.06)',
                        borderColor: 'rgba(99,102,241,0.2)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'between',
                            alignItems: 'start',
                        }}
                    >
                        <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                            <Info
                                size={20}
                                style={{
                                    color: 'var(--color-primary)',
                                    marginTop: '2px',
                                    flexShrink: 0,
                                }}
                            />
                            <div>
                                <h4
                                    style={{
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        color: 'var(--text-main)',
                                        marginBottom: '6px',
                                    }}
                                >
                                    AWS Amazon S3 integration environment
                                    variables (.env setup guide)
                                </h4>
                                <p
                                    style={{
                                        fontSize: '12.5px',
                                        color: 'var(--text-muted)',
                                        lineHeight: '1.6',
                                    }}
                                >
                                    To ensure that attachment file uploads work
                                    correctly in tickets and live support chats,
                                    the backend server requires Amazon S3
                                    credentials. Put the following environment
                                    keys inside your server's{' '}
                                    <code style={{ fontSize: '11px' }}>
                                        .env
                                    </code>{' '}
                                    file:
                                </p>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns:
                                            'repeat(auto-fit, minmax(220px, 1fr))',
                                        gap: '12px',
                                        marginTop: '12px',
                                    }}
                                >
                                    <div
                                        style={{
                                            background: 'rgba(0,0,0,0.3)',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '10px',
                                                color: 'var(--color-secondary)',
                                                fontWeight: 700,
                                            }}
                                        >
                                            AWS_ACCESS_KEY_ID
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '11px',
                                                color: 'var(--text-main)',
                                                marginTop: '3px',
                                            }}
                                        >
                                            Your IAM user S3 access ID key.
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            background: 'rgba(0,0,0,0.3)',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '10px',
                                                color: 'var(--color-secondary)',
                                                fontWeight: 700,
                                            }}
                                        >
                                            AWS_SECRET_ACCESS_KEY
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '11px',
                                                color: 'var(--text-main)',
                                                marginTop: '3px',
                                            }}
                                        >
                                            Your IAM user S3 secret key.
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            background: 'rgba(0,0,0,0.3)',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '10px',
                                                color: 'var(--color-secondary)',
                                                fontWeight: 700,
                                            }}
                                        >
                                            AWS_REGION
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '11px',
                                                color: 'var(--text-main)',
                                                marginTop: '3px',
                                            }}
                                        >
                                            Region of the S3 bucket (e.g.{' '}
                                            <code
                                                style={{
                                                    padding: '1px 4px',
                                                    fontSize: '9.5px',
                                                }}
                                            >
                                                us-east-1
                                            </code>
                                            ).
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            background: 'rgba(0,0,0,0.3)',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '10px',
                                                color: 'var(--color-secondary)',
                                                fontWeight: 700,
                                            }}
                                        >
                                            AWS_BUCKET_NAME
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '11px',
                                                color: 'var(--text-main)',
                                                marginTop: '3px',
                                            }}
                                        >
                                            Target S3 bucket name.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowEnvGuide(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                            }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Verification Auth Screen */}
            {authStep !== 'dashboard' && (
                <div className="auth-container">
                    <div className="auth-card glass-panel">
                        <div
                            style={{ textAlign: 'center', marginBottom: '8px' }}
                        >
                            <div
                                style={{
                                    background: 'rgba(99,102,241,0.1)',
                                    padding: '16px',
                                    borderRadius: '50%',
                                    width: 'fit-content',
                                    margin: '0 auto 16px',
                                }}
                            >
                                <Headset
                                    size={36}
                                    style={{ color: 'var(--color-primary)' }}
                                />
                            </div>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
                                Dev-HR Support verification
                            </h2>
                            <p
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--text-muted)',
                                    marginTop: '6px',
                                }}
                            >
                                Enter your identity details to authenticate a
                                secure Guest session.
                            </p>
                        </div>

                        {authError && (
                            <div
                                className="glass-panel"
                                style={{
                                    padding: '12px 16px',
                                    borderColor: 'rgba(239,68,68,0.2)',
                                    background: 'rgba(239,68,68,0.05)',
                                    color: '#fca5a5',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'center',
                                }}
                            >
                                <AlertCircle size={16} />
                                <span>{authError}</span>
                            </div>
                        )}

                        {authStep === 'register' ? (
                            <form
                                onSubmit={handleRequestOtp}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                    }}
                                >
                                    <label
                                        style={{
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            color: 'var(--text-muted)',
                                        }}
                                    >
                                        Your Full Name
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <User
                                            size={16}
                                            style={{
                                                position: 'absolute',
                                                left: '12px',
                                                top: '14px',
                                                color: 'var(--text-sub)',
                                            }}
                                        />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Jane Doe"
                                            value={guestName}
                                            onChange={(e) =>
                                                setGuestName(e.target.value)
                                            }
                                            className="premium-input"
                                            style={{
                                                paddingLeft: '40px',
                                                width: '100%',
                                            }}
                                        />
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                    }}
                                >
                                    <label
                                        style={{
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            color: 'var(--text-muted)',
                                        }}
                                    >
                                        Email Address
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Mail
                                            size={16}
                                            style={{
                                                position: 'absolute',
                                                left: '12px',
                                                top: '14px',
                                                color: 'var(--text-sub)',
                                            }}
                                        />
                                        <input
                                            type="email"
                                            required
                                            placeholder="jane@example.com"
                                            value={guestEmail}
                                            onChange={(e) =>
                                                setGuestEmail(e.target.value)
                                            }
                                            className="premium-input"
                                            style={{
                                                paddingLeft: '40px',
                                                width: '100%',
                                            }}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={authLoading}
                                    className="btn-primary"
                                    style={{ width: '100%' }}
                                >
                                    {authLoading
                                        ? 'Requesting OTP...'
                                        : 'Send Verification OTP'}
                                </button>
                            </form>
                        ) : (
                            <form
                                onSubmit={handleVerifyOtp}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                    }}
                                >
                                    <label
                                        style={{
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            color: 'var(--text-muted)',
                                        }}
                                    >
                                        6-Digit Verification Code
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock
                                            size={16}
                                            style={{
                                                position: 'absolute',
                                                left: '12px',
                                                top: '14px',
                                                color: 'var(--text-sub)',
                                            }}
                                        />
                                        <input
                                            type="text"
                                            required
                                            maxLength={6}
                                            placeholder="123456"
                                            value={otpCode}
                                            onChange={(e) =>
                                                setOtpCode(e.target.value)
                                            }
                                            className="premium-input"
                                            style={{
                                                paddingLeft: '40px',
                                                width: '100%',
                                                letterSpacing: '8px',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setAuthStep('register')}
                                        className="btn-secondary"
                                        style={{ flex: 1 }}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={authLoading}
                                        className="btn-primary"
                                        style={{ flex: 2 }}
                                    >
                                        {authLoading
                                            ? 'Verifying...'
                                            : 'Verify Code & Sign In'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Developer Bypass Sandbox Box */}
                        <div
                            style={{
                                marginTop: '16px',
                                paddingTop: '16px',
                                borderTop: '1px solid var(--border-glass)',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: 'var(--color-primary)',
                                    fontSize: '12.5px',
                                    fontWeight: 700,
                                    marginBottom: '8px',
                                }}
                            >
                                <ShieldCheck size={16} />
                                <span>Developer Bypass Sandbox</span>
                            </div>
                            <p
                                style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    marginBottom: '12px',
                                    lineHeight: '1.4',
                                }}
                            >
                                Already logged in elsewhere or want to test with
                                a specific admin token? Paste your token below:
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="Paste JWT / session token..."
                                    id="bypass-token"
                                    className="premium-input"
                                    style={{
                                        flex: 1,
                                        padding: '6px 10px',
                                        fontSize: '11px',
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleDevBypass(
                                                (e.target as HTMLInputElement)
                                                    .value,
                                            );
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        const el = document.getElementById(
                                            'bypass-token',
                                        ) as HTMLInputElement;
                                        handleDevBypass(el?.value || '');
                                    }}
                                    className="btn-secondary"
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '11px',
                                    }}
                                >
                                    Bypass
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Support Workspace */}
            {authStep === 'dashboard' && (
                <main className="main-layout">
                    {/* Quick tab switcher */}
                    <div className="tabs-header">
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                        >
                            <MessageSquare size={16} /> Live Support Chat
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('tickets');
                                loadTickets();
                            }}
                            className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`}
                        >
                            <Ticket size={16} /> Ticketing Hub Workspace
                        </button>
                    </div>

                    <div className="panel-container">
                        {/* VIEW 1: LIVE CHAT TAB */}
                        {activeTab === 'chat' && (
                            <>
                                {/* Left Pane: Chat Control Dashboard */}
                                <div className="sidebar">
                                    <div
                                        className="glass-panel"
                                        style={{
                                            padding: '20px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '16px',
                                        }}
                                    >
                                        <h3
                                            style={{
                                                fontSize: '14px',
                                                fontWeight: 700,
                                            }}
                                        >
                                            Chat Connection State
                                        </h3>

                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '12px',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent:
                                                        'space-between',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: '12px',
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    Guest Name:
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {guestName}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent:
                                                        'space-between',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: '12px',
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    Email:
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {guestEmail}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent:
                                                        'space-between',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: '12px',
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    Session State:
                                                </span>
                                                {chatSession ? (
                                                    <span
                                                        className={`badge ${chatSession.status === 'active' ? 'badge-emerald' : 'badge-amber'}`}
                                                    >
                                                        {chatSession.status}
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-rose">
                                                        No active session
                                                    </span>
                                                )}
                                            </div>

                                            {chatSession &&
                                                chatSession.status ===
                                                    'queued' && (
                                                    <div
                                                        style={{
                                                            background:
                                                                'rgba(245,158,11,0.06)',
                                                            border: '1px solid rgba(245,158,11,0.2)',
                                                            padding: '10px',
                                                            borderRadius: '8px',
                                                            fontSize: '12px',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                fontWeight: 700,
                                                                color: 'var(--color-accent)',
                                                                display: 'flex',
                                                                gap: '6px',
                                                                alignItems:
                                                                    'center',
                                                            }}
                                                        >
                                                            <Clock size={14} />{' '}
                                                            Waiting in queue...
                                                        </div>
                                                        <div
                                                            style={{
                                                                color: 'var(--text-muted)',
                                                                marginTop:
                                                                    '4px',
                                                            }}
                                                        >
                                                            Current Position:{' '}
                                                            <span
                                                                style={{
                                                                    color: '#fff',
                                                                    fontWeight:
                                                                        'bold',
                                                                }}
                                                            >
                                                                #
                                                                {queuePosition ||
                                                                    1}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                            {activeAgent && (
                                                <div
                                                    style={{
                                                        background:
                                                            'rgba(16,185,129,0.06)',
                                                        border: '1px solid rgba(16,185,129,0.2)',
                                                        padding: '10px',
                                                        borderRadius: '8px',
                                                        fontSize: '12px',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontWeight: 700,
                                                            color: 'var(--color-success)',
                                                        }}
                                                    >
                                                        Agent Claimed Chat
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: 'var(--text-main)',
                                                            marginTop: '4px',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {activeAgent.name ||
                                                            'Support Agent'}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '10px',
                                                marginTop: '10px',
                                            }}
                                        >
                                            {!chatSession ? (
                                                <button
                                                    onClick={
                                                        handleStartLiveChat
                                                    }
                                                    className="btn-primary"
                                                    style={{ width: '100%' }}
                                                >
                                                    Start Live Chat Session
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleCloseChat}
                                                    className="btn-danger"
                                                    style={{
                                                        width: '100%',
                                                        gap: '6px',
                                                    }}
                                                >
                                                    <X size={14} /> End Chat
                                                    Session
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Pane: Conversation window */}
                                <div
                                    className="content-area glass-panel"
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        height: '100%',
                                    }}
                                >
                                    {!chatSession ? (
                                        <div className="empty-state">
                                            <MessageSquare size={48} />
                                            <h3
                                                style={{
                                                    fontSize: '16px',
                                                    fontWeight: 700,
                                                    marginBottom: '6px',
                                                }}
                                            >
                                                No Support Chat Active
                                            </h3>
                                            <p
                                                style={{
                                                    fontSize: '13px',
                                                    maxWidth: '320px',
                                                }}
                                            >
                                                Click "Start Live Chat Session"
                                                on the left to queue up and
                                                connect to a real-time support
                                                representative.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Chat Messages Timeline Stream */}
                                            <div className="chat-bubbles-container">
                                                {chatMessages.length === 0 && (
                                                    <div
                                                        style={{
                                                            textAlign: 'center',
                                                            padding: '24px',
                                                            fontSize: '12px',
                                                            color: 'var(--text-sub)',
                                                        }}
                                                    >
                                                        Conversation opened.
                                                        Send a message to say
                                                        hello.
                                                    </div>
                                                )}
                                                {chatMessages.map(
                                                    (msg, idx) => {
                                                        const isSelf =
                                                            msg.sender ===
                                                                'guest' ||
                                                            msg.senderModel ===
                                                                'Guest';
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`chat-bubble-wrapper ${isSelf ? 'self' : 'other'}`}
                                                            >
                                                                <div className="chat-bubble-meta">
                                                                    <span>
                                                                        {isSelf
                                                                            ? 'You'
                                                                            : msg.senderName}
                                                                    </span>
                                                                    <span>
                                                                        •
                                                                    </span>
                                                                    <span>
                                                                        {new Date(
                                                                            msg.createdAt,
                                                                        ).toLocaleTimeString(
                                                                            [],
                                                                            {
                                                                                hour: '2-digit',
                                                                                minute: '2-digit',
                                                                            },
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div
                                                                    className={`chat-bubble ${msg.isInternal ? 'internal' : ''}`}
                                                                >
                                                                    <p
                                                                        style={{
                                                                            margin: 0,
                                                                            whiteSpace:
                                                                                'pre-wrap',
                                                                        }}
                                                                    >
                                                                        {
                                                                            msg.content
                                                                        }
                                                                    </p>

                                                                    {msg.attachments &&
                                                                        msg
                                                                            .attachments
                                                                            .length >
                                                                            0 && (
                                                                            <div
                                                                                style={{
                                                                                    marginTop:
                                                                                        '8px',
                                                                                    paddingTop:
                                                                                        '8px',
                                                                                    borderTop:
                                                                                        '1px solid rgba(255,255,255,0.06)',
                                                                                    display:
                                                                                        'flex',
                                                                                    flexDirection:
                                                                                        'column',
                                                                                    gap: '4px',
                                                                                }}
                                                                            >
                                                                                {msg.attachments.map(
                                                                                    (
                                                                                        file: any,
                                                                                        fIdx: number,
                                                                                    ) => (
                                                                                        <a
                                                                                            key={
                                                                                                fIdx
                                                                                            }
                                                                                            href={
                                                                                                file.url
                                                                                            }
                                                                                            target="_blank"
                                                                                            rel="noreferrer"
                                                                                            style={{
                                                                                                fontSize:
                                                                                                    '11px',
                                                                                                color: 'var(--color-secondary)',
                                                                                                display:
                                                                                                    'flex',
                                                                                                alignItems:
                                                                                                    'center',
                                                                                                gap: '4px',
                                                                                                textDecoration:
                                                                                                    'none',
                                                                                            }}
                                                                                        >
                                                                                            <Paperclip
                                                                                                size={
                                                                                                    11
                                                                                                }
                                                                                            />{' '}
                                                                                            {
                                                                                                file.fileName
                                                                                            }
                                                                                        </a>
                                                                                    ),
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                </div>
                                                            </div>
                                                        );
                                                    },
                                                )}

                                                {typingStatus &&
                                                    typingStatus.isTyping && (
                                                        <div className="chat-bubble-wrapper other">
                                                            <span
                                                                style={{
                                                                    fontSize:
                                                                        '10px',
                                                                    color: 'var(--text-sub)',
                                                                    marginBottom:
                                                                        '4px',
                                                                }}
                                                            >
                                                                {
                                                                    typingStatus.name
                                                                }
                                                            </span>
                                                            <div
                                                                className="chat-bubble"
                                                                style={{
                                                                    opacity: 0.8,
                                                                    fontStyle:
                                                                        'italic',
                                                                    padding:
                                                                        '8px 12px',
                                                                    fontSize:
                                                                        '12px',
                                                                }}
                                                            >
                                                                Typing
                                                                message...
                                                            </div>
                                                        </div>
                                                    )}
                                                <div ref={chatBottomRef} />
                                            </div>

                                            {/* File attachment progress */}
                                            {uploadProgress !== null && (
                                                <div
                                                    style={{
                                                        padding: '8px 20px',
                                                        borderTop:
                                                            '1px solid var(--border-glass)',
                                                        background:
                                                            'rgba(99,102,241,0.05)',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent:
                                                                'space-between',
                                                            fontSize: '11px',
                                                            color: 'var(--text-muted)',
                                                            marginBottom: '4px',
                                                        }}
                                                    >
                                                        <span>
                                                            Uploading S3
                                                            Presigned
                                                            attachment...
                                                        </span>
                                                        <span>
                                                            {uploadProgress}%
                                                        </span>
                                                    </div>
                                                    <div
                                                        style={{
                                                            width: '100%',
                                                            height: '3px',
                                                            background:
                                                                'rgba(255,255,255,0.05)',
                                                            borderRadius: '9px',
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: `${uploadProgress}%`,
                                                                height: '100%',
                                                                background:
                                                                    'var(--color-primary)',
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Uploaded attachments badge tray */}
                                            {selectedFiles.length > 0 && (
                                                <div
                                                    style={{
                                                        padding: '8px 20px',
                                                        display: 'flex',
                                                        gap: '8px',
                                                        flexWrap: 'wrap',
                                                        borderTop:
                                                            '1px solid var(--border-glass)',
                                                    }}
                                                >
                                                    {selectedFiles.map(
                                                        (file, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="badge badge-indigo"
                                                                style={{
                                                                    display:
                                                                        'flex',
                                                                    alignItems:
                                                                        'center',
                                                                    gap: '6px',
                                                                    textTransform:
                                                                        'none',
                                                                    padding:
                                                                        '6px 10px',
                                                                }}
                                                            >
                                                                <Paperclip
                                                                    size={11}
                                                                />
                                                                <span
                                                                    style={{
                                                                        maxWidth:
                                                                            '120px',
                                                                        overflow:
                                                                            'hidden',
                                                                        textOverflow:
                                                                            'ellipsis',
                                                                        whiteSpace:
                                                                            'nowrap',
                                                                    }}
                                                                >
                                                                    {file.name}
                                                                </span>
                                                                <button
                                                                    onClick={() =>
                                                                        setSelectedFiles(
                                                                            (
                                                                                prev,
                                                                            ) =>
                                                                                prev.filter(
                                                                                    (
                                                                                        _,
                                                                                        i,
                                                                                    ) =>
                                                                                        i !==
                                                                                        idx,
                                                                                ),
                                                                        )
                                                                    }
                                                                    style={{
                                                                        background:
                                                                            'none',
                                                                        border: 'none',
                                                                        color: '#ff4444',
                                                                        cursor: 'pointer',
                                                                        padding: 0,
                                                                    }}
                                                                >
                                                                    <X
                                                                        size={
                                                                            12
                                                                        }
                                                                    />
                                                                </button>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}

                                            {/* Message Input Box toolbar */}
                                            <form
                                                onSubmit={handleSendChatMessage}
                                                className="chat-input-bar"
                                            >
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileUpload}
                                                    style={{ display: 'none' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        fileInputRef.current?.click()
                                                    }
                                                    className="btn-secondary"
                                                    style={{ padding: '12px' }}
                                                    title="Attach files to S3"
                                                >
                                                    <Paperclip size={18} />
                                                </button>

                                                <input
                                                    type="text"
                                                    placeholder="Type your support message..."
                                                    value={chatInput}
                                                    onChange={(e) => {
                                                        setChatInput(
                                                            e.target.value,
                                                        );
                                                        handleTypingEvent();
                                                    }}
                                                    className="premium-input"
                                                    style={{ flex: 1 }}
                                                />
                                                <button
                                                    type="submit"
                                                    className="btn-primary"
                                                    style={{
                                                        padding: '12px 20px',
                                                    }}
                                                >
                                                    <Send size={16} /> Send
                                                </button>
                                            </form>
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        {/* VIEW 2: SUPPORT TICKETS TAB */}
                        {activeTab === 'tickets' && (
                            <>
                                {/* Left Pane: Tickets listing and Form */}
                                <div
                                    className="sidebar"
                                    style={{ gap: '20px' }}
                                >
                                    {/* Create Ticket Form */}
                                    <div
                                        className="glass-panel"
                                        style={{ padding: '20px' }}
                                    >
                                        <h3
                                            style={{
                                                fontSize: '14px',
                                                fontWeight: 700,
                                                marginBottom: '16px',
                                            }}
                                        >
                                            Create Support Ticket
                                        </h3>
                                        <form
                                            onSubmit={handleCreateTicket}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '12px',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                }}
                                            >
                                                <label
                                                    style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    Ticket Subject
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Billing discrepancy / API crash"
                                                    value={newTicketSubject}
                                                    onChange={(e) =>
                                                        setNewTicketSubject(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="premium-input"
                                                    style={{
                                                        padding: '8px 12px',
                                                        fontSize: '13px',
                                                    }}
                                                />
                                            </div>

                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                }}
                                            >
                                                <label
                                                    style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    Detailed Description
                                                </label>
                                                <textarea
                                                    required
                                                    rows={4}
                                                    placeholder="Please provide steps to reproduce the issue..."
                                                    value={newTicketText}
                                                    onChange={(e) =>
                                                        setNewTicketText(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="premium-input"
                                                    style={{
                                                        padding: '8px 12px',
                                                        fontSize: '13px',
                                                        resize: 'vertical',
                                                    }}
                                                />
                                            </div>

                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                }}
                                            >
                                                <label
                                                    style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    Issue Priority
                                                </label>
                                                <select
                                                    value={newTicketPriority}
                                                    onChange={(e: any) =>
                                                        setNewTicketPriority(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="premium-input"
                                                    style={{
                                                        padding: '8px 12px',
                                                        fontSize: '13px',
                                                    }}
                                                >
                                                    <option value="low">
                                                        Low Priority
                                                    </option>
                                                    <option value="medium">
                                                        Medium Priority
                                                    </option>
                                                    <option value="high">
                                                        High Priority
                                                    </option>
                                                </select>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={ticketLoading}
                                                className="btn-primary"
                                                style={{ marginTop: '8px' }}
                                            >
                                                {ticketLoading
                                                    ? 'Submitting...'
                                                    : 'Submit Support Ticket'}
                                            </button>
                                        </form>
                                    </div>

                                    {/* Registered Tickets list */}
                                    <div
                                        className="glass-panel"
                                        style={{
                                            padding: '20px',
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            minHeight: '300px',
                                        }}
                                    >
                                        <h3
                                            style={{
                                                fontSize: '14px',
                                                fontWeight: 700,
                                                marginBottom: '12px',
                                            }}
                                        >
                                            Your Tickets ({tickets.length})
                                        </h3>

                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '10px',
                                                overflowY: 'auto',
                                                flex: 1,
                                            }}
                                        >
                                            {tickets.length === 0 ? (
                                                <div
                                                    style={{
                                                        textAlign: 'center',
                                                        padding: '24px',
                                                        fontSize: '12px',
                                                        color: 'var(--text-sub)',
                                                    }}
                                                >
                                                    No tickets created yet.
                                                </div>
                                            ) : (
                                                tickets.map((ticket) => (
                                                    <div
                                                        key={ticket._id}
                                                        onClick={() =>
                                                            loadTicketDetails(
                                                                ticket._id,
                                                            )
                                                        }
                                                        className={`ticket-list-item ${selectedTicket?._id === ticket._id ? 'active' : ''}`}
                                                    >
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent:
                                                                    'space-between',
                                                                alignItems:
                                                                    'center',
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    fontSize:
                                                                        '11px',
                                                                    fontWeight:
                                                                        'bold',
                                                                    color: 'var(--color-primary)',
                                                                }}
                                                            >
                                                                {
                                                                    ticket.ticketId
                                                                }
                                                            </span>
                                                            <span
                                                                className={`badge ${
                                                                    ticket.status ===
                                                                    'open'
                                                                        ? 'badge-rose'
                                                                        : ticket.status ===
                                                                            'in_progress'
                                                                          ? 'badge-amber'
                                                                          : ticket.status ===
                                                                              'pending_client'
                                                                            ? 'badge-sky'
                                                                            : 'badge-emerald'
                                                                }`}
                                                            >
                                                                {ticket.status.replace(
                                                                    '_',
                                                                    ' ',
                                                                )}
                                                            </span>
                                                        </div>
                                                        <h4
                                                            style={{
                                                                fontSize:
                                                                    '13px',
                                                                fontWeight: 600,
                                                                color: 'var(--text-main)',
                                                                overflow:
                                                                    'hidden',
                                                                textOverflow:
                                                                    'ellipsis',
                                                                whiteSpace:
                                                                    'nowrap',
                                                            }}
                                                        >
                                                            {ticket.subject}
                                                        </h4>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent:
                                                                    'space-between',
                                                                fontSize:
                                                                    '10px',
                                                                color: 'var(--text-sub)',
                                                            }}
                                                        >
                                                            <span>
                                                                Priority:{' '}
                                                                <strong
                                                                    style={{
                                                                        color: '#fff',
                                                                    }}
                                                                >
                                                                    {
                                                                        ticket.priority
                                                                    }
                                                                </strong>
                                                            </span>
                                                            <span>
                                                                {new Date(
                                                                    ticket.updatedAt,
                                                                ).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Pane: Ticket details workspace */}
                                <div className="content-area glass-panel">
                                    {!selectedTicket ? (
                                        <div className="empty-state">
                                            <Ticket size={48} />
                                            <h3
                                                style={{
                                                    fontSize: '16px',
                                                    fontWeight: 700,
                                                    marginBottom: '6px',
                                                }}
                                            >
                                                No Support Ticket Selected
                                            </h3>
                                            <p
                                                style={{
                                                    fontSize: '13px',
                                                    maxWidth: '320px',
                                                }}
                                            >
                                                Select any registered ticket
                                                from the listing on the left to
                                                inspect its reply logs or send
                                                replies back to the support
                                                agents.
                                            </p>
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                height: '100%',
                                            }}
                                        >
                                            {/* Ticket stats header card */}
                                            <div
                                                style={{
                                                    padding: '20px',
                                                    borderBottom:
                                                        '1px solid var(--border-glass)',
                                                    background:
                                                        'rgba(255,255,255,0.01)',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent:
                                                            'space-between',
                                                        alignItems: 'start',
                                                        marginBottom: '8px',
                                                    }}
                                                >
                                                    <div>
                                                        <span
                                                            style={{
                                                                fontSize:
                                                                    '12px',
                                                                fontWeight:
                                                                    'bold',
                                                                color: 'var(--color-primary)',
                                                            }}
                                                        >
                                                            {
                                                                selectedTicket.ticketId
                                                            }
                                                        </span>
                                                        <h2
                                                            style={{
                                                                fontSize:
                                                                    '16px',
                                                                fontWeight: 700,
                                                                margin: '2px 0 0',
                                                            }}
                                                        >
                                                            {
                                                                selectedTicket.subject
                                                            }
                                                        </h2>
                                                    </div>

                                                    <span
                                                        className={`badge ${
                                                            selectedTicket.status ===
                                                            'open'
                                                                ? 'badge-rose'
                                                                : selectedTicket.status ===
                                                                    'in_progress'
                                                                  ? 'badge-amber'
                                                                  : selectedTicket.status ===
                                                                      'pending_client'
                                                                    ? 'badge-sky'
                                                                    : 'badge-emerald'
                                                        }`}
                                                    >
                                                        {selectedTicket.status.replace(
                                                            '_',
                                                            ' ',
                                                        )}
                                                    </span>
                                                </div>

                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: '20px',
                                                        fontSize: '12px',
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    <div>
                                                        Priority:{' '}
                                                        <span
                                                            className="badge badge-indigo"
                                                            style={{
                                                                padding:
                                                                    '2px 6px',
                                                                fontSize:
                                                                    '10px',
                                                            }}
                                                        >
                                                            {
                                                                selectedTicket.priority
                                                            }
                                                        </span>
                                                    </div>
                                                    <div>
                                                        Assignee:{' '}
                                                        <span
                                                            style={{
                                                                color: '#fff',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {selectedTicket
                                                                .assignedTo
                                                                ?.name ||
                                                                'Unassigned'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        Created:{' '}
                                                        <span>
                                                            {new Date(
                                                                selectedTicket.createdAt,
                                                            ).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Ticket Replies message history */}
                                            <div
                                                style={{
                                                    flex: 1,
                                                    overflowY: 'auto',
                                                    padding: '20px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '16px',
                                                }}
                                            >
                                                {ticketMessages.map(
                                                    (msg, idx) => {
                                                        const isSelf =
                                                            msg.senderModel ===
                                                                'Client' ||
                                                            msg.senderModel ===
                                                                'Guest';
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`chat-bubble-wrapper ${isSelf ? 'self' : 'other'}`}
                                                                style={{
                                                                    maxWidth:
                                                                        '85%',
                                                                }}
                                                            >
                                                                <div className="chat-bubble-meta">
                                                                    <span>
                                                                        {isSelf
                                                                            ? 'You'
                                                                            : msg.senderName ||
                                                                              'Staff Agent'}
                                                                    </span>
                                                                    <span>
                                                                        •
                                                                    </span>
                                                                    <span>
                                                                        {new Date(
                                                                            msg.createdAt,
                                                                        ).toLocaleString(
                                                                            [],
                                                                            {
                                                                                dateStyle:
                                                                                    'short',
                                                                                timeStyle:
                                                                                    'short',
                                                                            },
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div
                                                                    className="chat-bubble"
                                                                    style={{
                                                                        background:
                                                                            isSelf
                                                                                ? 'rgba(99,102,241,0.08)'
                                                                                : 'rgba(255,255,255,0.04)',
                                                                        border: '1px solid var(--border-glass)',
                                                                    }}
                                                                >
                                                                    <p
                                                                        style={{
                                                                            margin: 0,
                                                                            whiteSpace:
                                                                                'pre-wrap',
                                                                        }}
                                                                    >
                                                                        {
                                                                            msg.content
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    },
                                                )}
                                            </div>

                                            {/* Ticket response input editor */}
                                            {selectedTicket.status !==
                                            'closed' ? (
                                                <form
                                                    onSubmit={
                                                        handleReplyToTicket
                                                    }
                                                    style={{
                                                        padding: '16px 20px',
                                                        borderTop:
                                                            '1px solid var(--border-glass)',
                                                        display: 'flex',
                                                        gap: '12px',
                                                    }}
                                                >
                                                    <input
                                                        type="text"
                                                        placeholder="Write a message reply to support representatives..."
                                                        value={ticketReplyText}
                                                        onChange={(e) =>
                                                            setTicketReplyText(
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="premium-input"
                                                        style={{ flex: 1 }}
                                                    />
                                                    <button
                                                        type="submit"
                                                        className="btn-primary"
                                                        style={{
                                                            padding:
                                                                '12px 24px',
                                                        }}
                                                    >
                                                        <Send size={16} /> Send
                                                        Reply
                                                    </button>
                                                </form>
                                            ) : (
                                                <div
                                                    style={{
                                                        padding: '16px 20px',
                                                        borderTop:
                                                            '1px solid var(--border-glass)',
                                                        background:
                                                            'rgba(239,68,68,0.05)',
                                                        color: '#fca5a5',
                                                        textAlign: 'center',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    This Support Ticket has been
                                                    resolved and closed.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* System Diagnostics Logger Tray Console */}
                    <div
                        className="glass-panel"
                        style={{
                            padding: '16px 20px',
                            borderRadius: '12px',
                            borderTop: '1px solid var(--border-glass)',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '12px',
                            }}
                        >
                            <Terminal
                                size={16}
                                style={{ color: 'var(--color-primary)' }}
                            />
                            <h3
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    margin: 0,
                                }}
                            >
                                System WebSocket & API Diagnostics console logs
                            </h3>
                            <span
                                className="badge badge-sky"
                                style={{ fontSize: '9px', padding: '2px 6px' }}
                            >
                                Dev diagnostics
                            </span>
                        </div>

                        <div
                            style={{
                                height: '140px',
                                background: '#040711',
                                borderRadius: '8px',
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                padding: '12px',
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                border: '1px solid rgba(255,255,255,0.05)',
                            }}
                        >
                            {systemLogs.length === 0 ? (
                                <div style={{ color: 'var(--text-sub)' }}>
                                    Listening for connections and network
                                    diagnostics...
                                </div>
                            ) : (
                                systemLogs.map((log) => (
                                    <div
                                        key={log.id}
                                        style={{
                                            display: 'flex',
                                            gap: '8px',
                                            lineHeight: '1.4',
                                        }}
                                    >
                                        <span
                                            style={{ color: 'var(--text-sub)' }}
                                        >
                                            [{log.time}]
                                        </span>
                                        <span
                                            style={{
                                                color: log.event.includes(
                                                    'Error',
                                                )
                                                    ? '#ff4444'
                                                    : log.event.includes(
                                                            'Socket Event',
                                                        )
                                                      ? '#a5b4fc'
                                                      : '#10b981',
                                                fontWeight: 'bold',
                                            }}
                                        >
                                            {log.event}
                                        </span>
                                        <span
                                            style={{
                                                color: 'var(--text-muted)',
                                            }}
                                        >
                                            {log.payload
                                                ? JSON.stringify(log.payload)
                                                : ''}
                                        </span>
                                    </div>
                                ))
                            )}
                            <div ref={logsBottomRef} />
                        </div>
                    </div>
                </main>
            )}
        </div>
    );
}

export default App;
