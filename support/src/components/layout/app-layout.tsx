'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    MessageSquare,
    Ticket,
    Users,
    Settings,
    PanelLeft,
    Bell,
    Search,
    Moon,
    Sun,
    LogOut,
    Loader2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useDispatch } from 'react-redux';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from '@/components/ui/sheet';
import Logo from '@/components/logo';
import { authClient, useSession } from '@/lib/auth-client';
import { redirectToSignIn } from '@/lib/auth-redirect';
import { formatRole } from '@/lib/format-role';
import { useGetQueuedSessionsQuery } from '@/store/api/chatApi';
import { useGetUnreadNotificationCountQuery } from '@/store/api/notificationApi';
import { baseApi } from '@/store/api/baseApi';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { AppDispatch } from '@/store';
import type { Socket } from 'socket.io-client';

// ─── nav config ──────────────────────────────────────────────────────────────

interface NavItem {
    label: string;
    href: string;
    icon: React.ElementType;
    badgeVariant?: 'destructive' | 'secondary';
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        label: 'MAIN',
        items: [
            { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
            { label: 'Live Chat', href: '/live-chat', icon: MessageSquare, badgeVariant: 'destructive' },
        ],
    },
    {
        label: 'SUPPORT',
        items: [
            { label: 'Tickets', href: '/tickets', icon: Ticket, badgeVariant: 'secondary' },
            { label: 'Clients', href: '/clients', icon: Users },
        ],
    },
    {
        label: 'SYSTEM',
        items: [
            { label: 'Settings', href: '/settings', icon: Settings },
        ],
    },
];

function isActive(href: string, pathname: string): boolean {
    return pathname === href || pathname.startsWith(href + '/');
}

function getPageTitle(pathname: string): string {
    for (const group of NAV_GROUPS) {
        for (const item of group.items) {
            if (isActive(item.href, pathname)) return item.label;
        }
    }
    return 'Support Console';
}

// ─── NavContent ───────────────────────────────────────────────────────────────

interface NavContentProps {
    pathname: string;
    liveChatCount: number;
    onNavigate?: () => void;
}

function NavContent({ pathname, liveChatCount, onNavigate }: NavContentProps) {
    const dynamicBadge: Record<string, number> = {
        '/live-chat': liveChatCount,
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b shrink-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <Logo className="max-w-[110px]" />
                </div>
            </div>

            {/* Search */}
            <div className="px-3 py-2 shrink-0">
                <button className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-3 h-8 text-sm text-muted-foreground hover:bg-muted transition-colors">
                    <Search className="size-3.5 shrink-0" />
                    <span className="flex-1 text-left text-xs">Search...</span>
                    <kbd className="text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5 leading-none">
                        ⌘K
                    </kbd>
                </button>
            </div>

            {/* Nav groups */}
            <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
                {NAV_GROUPS.map((group) => (
                    <div key={group.label}>
                        <p className="px-2 mb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                            {group.label}
                        </p>
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href, pathname);
                                const badge = dynamicBadge[item.href] ?? 0;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onNavigate}
                                        className={cn(
                                            'group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors',
                                            active
                                                ? 'bg-primary text-primary-foreground font-medium'
                                                : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                                        )}
                                    >
                                        <Icon className="size-4 shrink-0" />
                                        <span className="flex-1 truncate">{item.label}</span>
                                        {badge > 0 && (
                                            <span
                                                className={cn(
                                                    'inline-flex items-center justify-center rounded-full text-[10px] font-semibold min-w-[18px] h-[18px] px-1',
                                                    active
                                                        ? 'bg-primary-foreground/20 text-primary-foreground'
                                                        : item.badgeVariant === 'destructive'
                                                            ? 'bg-destructive text-destructive-foreground'
                                                            : 'bg-muted text-muted-foreground',
                                                )}
                                            >
                                                {badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

        </div>
    );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const dispatch = useDispatch<AppDispatch>();
    const socketRef = useRef<Socket | null>(null);

    const { theme, setTheme, systemTheme } = useTheme();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [signingOut, setSigningOut] = useState(false);

    // ── real-time data ────────────────────────────────────────────────────────
    const { data: queuedSessions = [] } = useGetQueuedSessionsQuery(undefined, {
        pollingInterval: 30_000,
    });
    const { data: unreadCount = 0 } = useGetUnreadNotificationCountQuery(undefined, {
        pollingInterval: 30_000,
    });

    const liveChatCount = queuedSessions.length;

    // ── socket: live queue updates ─────────────────────────────��──────────────
    useEffect(() => {
        const socket = connectSocket();
        socketRef.current = socket;

        const onConnect = () => socket.emit('agent:register_presence');
        const onQueueUpdate = () => {
            dispatch(baseApi.util.invalidateTags(['QueuedSessions']));
        };

        socket.on('connect', onConnect);
        socket.on('queue:new_message', onQueueUpdate);

        if (socket.connected) onConnect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('queue:new_message', onQueueUpdate);
            disconnectSocket();
        };
    }, [dispatch]);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem('support-sidebar-open');
        if (stored !== null) setSidebarOpen(stored === 'true');
    }, []);

    const toggleSidebar = useCallback(() => {
        setSidebarOpen((prev) => {
            const next = !prev;
            localStorage.setItem('support-sidebar-open', String(next));
            return next;
        });
    }, []);

    const pageTitle = getPageTitle(pathname);
    const userName = session?.user?.name ?? 'Staff User';
    const userRoleRaw = (session?.user as { role?: string } | undefined)?.role ?? '';
    const userRole = formatRole(userRoleRaw) || 'Support Agent';
    const userEmail = session?.user?.email ?? '';
    const userImage = session?.user?.image ?? undefined;
    const initial = userName.trim().charAt(0).toUpperCase() || 'S';
    const isDark = (theme === 'system' ? systemTheme : theme) === 'dark';

    const handleSignOut = async () => {
        setSigningOut(true);
        await authClient.signOut();
        redirectToSignIn();
    };

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Desktop Sidebar */}
            <aside
                className={cn(
                    'hidden lg:flex flex-col border-r bg-sidebar shrink-0 overflow-hidden',
                    'transition-[width] duration-200 ease-in-out',
                    sidebarOpen ? 'w-[260px]' : 'w-0',
                )}
            >
                <div className="w-[260px] flex flex-col h-full">
                    <NavContent
                        pathname={pathname}
                        liveChatCount={liveChatCount}
                    />
                </div>
            </aside>

            {/* Mobile Sheet */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="p-0 w-[260px]" showCloseButton={false}>
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <NavContent
                        pathname={pathname}
                        liveChatCount={liveChatCount}
                        onNavigate={() => setMobileOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* Main */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open navigation"
                    >
                        <PanelLeft className="size-4" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="hidden lg:flex"
                        onClick={toggleSidebar}
                        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        <PanelLeft className="size-4" />
                    </Button>

                    <span className="text-sm font-medium">{pageTitle}</span>

                    <div className="flex-1" />

                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label="Search">
                            <Search className="size-4" />
                        </Button>

                        {/* Notification bell with real-time badge */}
                        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                            <Bell className="size-4" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </Button>

                        {mounted && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-2 ml-1 rounded-md px-2 py-1 hover:bg-accent transition-colors cursor-pointer">
                                        <Avatar className="size-8 rounded-full">
                                            <AvatarImage src={userImage || undefined} alt={userName} />
                                            <AvatarFallback className="rounded-full bg-primary/20 text-primary text-xs font-semibold">
                                                {initial}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="hidden sm:grid text-left text-sm leading-tight">
                                            <span className="truncate font-medium text-[13px]">{userName}</span>
                                            <span className="truncate text-[11px] text-muted-foreground">{userEmail}</span>
                                        </div>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="min-w-56 rounded-lg"
                                    align="end"
                                    sideOffset={8}
                                >
                                    <DropdownMenuLabel className="p-0 font-normal">
                                        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                            <Avatar className="size-8 rounded-full">
                                                <AvatarImage src={userImage || undefined} alt={userName} />
                                                <AvatarFallback className="rounded-full bg-primary/20 text-primary text-xs font-semibold">
                                                    {initial}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="grid flex-1 text-left text-sm leading-tight">
                                                <span className="truncate font-medium">{userName}</span>
                                                <span className="truncate text-xs text-muted-foreground">{userRole}</span>
                                            </div>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')}>
                                            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                                            {isDark ? 'Light mode' : 'Dark mode'}
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={handleSignOut}
                                        disabled={signingOut}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        {signingOut
                                            ? <Loader2 className="size-4 animate-spin" />
                                            : <LogOut className="size-4" />
                                        }
                                        {signingOut ? 'Signing out...' : 'Log out'}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
