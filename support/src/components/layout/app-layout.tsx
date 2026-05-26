'use client';

import { useState, useEffect, useCallback } from 'react';
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
    ChevronRight,
    Circle,
    Loader2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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

const NAV_GROUPS = [
    {
        label: 'MAIN',
        items: [
            { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, badge: null },
            { label: 'Live Chat', href: '/live-chat', icon: MessageSquare, badge: 3, badgeVariant: 'destructive' as const },
        ],
    },
    {
        label: 'SUPPORT',
        items: [
            { label: 'Tickets', href: '/tickets', icon: Ticket, badge: 12, badgeVariant: 'secondary' as const },
            { label: 'Clients', href: '/clients', icon: Users, badge: null },
        ],
    },
    {
        label: 'SYSTEM',
        items: [
            { label: 'Settings', href: '/settings', icon: Settings, badge: null },
        ],
    },
] as const;

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

interface NavContentProps {
    pathname: string;
    userName: string;
    userRole: string;
    onNavigate?: () => void;
}

function NavContent({ pathname, userName, userRole, onNavigate }: NavContentProps) {
    const { theme, setTheme, systemTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [signingOut, setSigningOut] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const isDark = (theme === 'system' ? systemTheme : theme) === 'dark';
    const initial = userName.trim().charAt(0).toUpperCase() || 'S';

    const handleSignOut = async () => {
        setSigningOut(true);
        await authClient.signOut();
        redirectToSignIn();
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b shrink-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <Logo className="max-w-[110px]" />
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                        Beta
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Support Console</p>
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
                                        {item.badge != null && (
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
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="border-t px-3 py-3 shrink-0">
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex flex-1 items-center gap-2.5 rounded-md px-1 py-1 hover:bg-accent transition-colors min-w-0">
                                <Avatar className="size-7 shrink-0">
                                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                                        {initial}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-[13px] font-medium leading-tight truncate">{userName}</p>
                                    <p className="text-[11px] text-muted-foreground leading-tight truncate">{userRole}</p>
                                </div>
                                <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" sideOffset={6} className="min-w-48">
                            <div className="px-2 py-1.5">
                                <p className="text-sm font-medium">{userName}</p>
                                <p className="text-xs text-muted-foreground">{userRole}</p>
                            </div>
                            <DropdownMenuSeparator />
                            {mounted && (
                                <DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')}>
                                    {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                                    {isDark ? 'Light mode' : 'Dark mode'}
                                </DropdownMenuItem>
                            )}
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

                    {mounted && (
                        <button
                            onClick={() => setTheme(isDark ? 'light' : 'dark')}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            aria-label="Toggle theme"
                        >
                            {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

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
    const initial = userName.trim().charAt(0).toUpperCase() || 'S';

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
                        userName={userName}
                        userRole={userRole}
                    />
                </div>
            </aside>

            {/* Mobile Sheet */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="p-0 w-[260px]" showCloseButton={false}>
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <NavContent
                        pathname={pathname}
                        userName={userName}
                        userRole={userRole}
                        onNavigate={() => setMobileOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* Main */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
                    {/* Mobile toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open navigation"
                    >
                        <PanelLeft className="size-4" />
                    </Button>

                    {/* Desktop toggle */}
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

                    {/* Right actions */}
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label="Search">
                            <Search className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                            <Bell className="size-4" />
                            <Circle className="absolute top-1.5 right-1.5 size-2 fill-destructive text-destructive" />
                        </Button>
                        {mounted && (
                            <Avatar className="size-7 cursor-pointer ml-1">
                                <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                                    {initial}
                                </AvatarFallback>
                            </Avatar>
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
