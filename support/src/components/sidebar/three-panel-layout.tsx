'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    Ticket,
    MessageSquare,
    Users,
    Settings,
    Moon,
    Sun,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Menu,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const sections = [
    {
        id: 'overview',
        title: 'Overview',
        description: 'Support dashboard and key metrics',
        icon: LayoutDashboard,
        url: '/dashboard',
        navItems: [
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Analytics', href: '/dashboard/analytics' },
        ],
    },
    {
        id: 'tickets',
        title: 'Tickets',
        description: 'Manage and respond to support tickets',
        icon: Ticket,
        url: '/tickets',
        navItems: [
            { label: 'All Tickets', href: '/tickets' },
            { label: 'Open', href: '/tickets/open' },
            { label: 'In Progress', href: '/tickets/in-progress' },
            { label: 'Resolved', href: '/tickets/resolved' },
            { label: 'Closed', href: '/tickets/closed' },
        ],
    },
    {
        id: 'live-chat',
        title: 'Live Chat',
        description: 'Handle real-time customer chat sessions',
        icon: MessageSquare,
        url: '/live-chat',
        navItems: [
            { label: 'Active Chats', href: '/live-chat' },
            { label: 'Queue', href: '/live-chat/queue' },
            { label: 'History', href: '/live-chat/history' },
        ],
    },
    {
        id: 'clients',
        title: 'Clients',
        description: 'View and manage client information',
        icon: Users,
        url: '/clients',
        navItems: [
            { label: 'All Clients', href: '/clients' },
            { label: 'Active', href: '/clients/active' },
            { label: 'Archived', href: '/clients/archived' },
        ],
    },
    {
        id: 'settings',
        title: 'Settings',
        description: 'Configure support preferences',
        icon: Settings,
        url: '/settings',
        navItems: [
            { label: 'General', href: '/settings' },
            { label: 'Notifications', href: '/settings/notifications' },
            { label: 'Team', href: '/settings/team' },
            { label: 'Integrations', href: '/settings/integrations' },
        ],
    },
] as const;

function isNavItemActive(href: string, pathname: string): boolean {
    // Top-level section roots use exact match to avoid over-highlighting
    const sectionRoots = ['/dashboard', '/tickets', '/live-chat', '/clients', '/settings'];
    if (sectionRoots.includes(href)) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
}

export default function ThreePanelLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { theme, setTheme, systemTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [navOpen, setNavOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem('support-nav-panel');
        if (stored !== null) setNavOpen(stored === 'true');
    }, []);

    const toggleNav = useCallback(() => {
        setNavOpen((prev) => {
            const next = !prev;
            localStorage.setItem('support-nav-panel', String(next));
            return next;
        });
    }, []);

    const activeSection = sections.find((s) => pathname.startsWith(s.url)) ?? sections[0];
    const isDark = (theme === 'system' ? systemTheme : theme) === 'dark';

    const navPanelInner = (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b shrink-0">
                <p className="font-semibold text-sm text-foreground">
                    {activeSection.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {activeSection.description}
                </p>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {activeSection.navItems.map((item) => {
                    const active = isNavItemActive(item.href, pathname);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                                'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                                active
                                    ? 'bg-primary text-primary-foreground font-medium'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                            )}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden bg-background">

            {/* ─── Panel 1: Icon Rail ─────────────────────────────────── */}
            <aside className="hidden lg:flex w-14 shrink-0 flex-col items-center border-r bg-sidebar py-3 gap-1">

                {/* Logo mark */}
                <Link
                    href="/dashboard"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-2 hover:bg-primary/90 transition-colors"
                >
                    <span className="text-sm font-bold">W</span>
                </Link>

                {/* Section icons */}
                <div className="flex flex-1 flex-col gap-1 w-full px-1.5">
                    {sections.map((section) => {
                        const Icon = section.icon;
                        const isActive = pathname.startsWith(section.url);
                        return (
                            <Tooltip key={section.id} delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={section.url}
                                        className={cn(
                                            'flex h-9 w-full items-center justify-center rounded-md transition-colors',
                                            isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                        )}
                                    >
                                        <Icon className="size-4" />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    {section.title}
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </div>

                {/* Bottom actions */}
                <div className="flex flex-col gap-1 w-full px-1.5">
                    {mounted && (
                        <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                                    className="flex h-9 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                                    aria-label="Toggle theme"
                                >
                                    {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                {isDark ? 'Light mode' : 'Dark mode'}
                            </TooltipContent>
                        </Tooltip>
                    )}

                    <DropdownMenu>
                        <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="flex h-9 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                                        aria-label="Account menu"
                                    >
                                        <Avatar className="size-6">
                                            <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                                                S
                                            </AvatarFallback>
                                        </Avatar>
                                    </button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="right">Account</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent side="right" align="end" sideOffset={8} className="min-w-48">
                            <div className="px-2 py-1.5">
                                <p className="text-sm font-medium">Staff User</p>
                                <p className="text-xs text-muted-foreground">Support Agent</p>
                            </div>
                            <DropdownMenuSeparator />
                            {mounted && (
                                <DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')}>
                                    {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                                    {isDark ? 'Light mode' : 'Dark mode'}
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                                <LogOut className="size-4" />
                                Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </aside>

            {/* ─── Panel 2: Nav Panel (desktop, collapsible) ──────────── */}
            <aside
                className={cn(
                    'hidden lg:flex flex-col border-r bg-sidebar overflow-hidden shrink-0',
                    'transition-[width] duration-300 ease-in-out',
                    navOpen ? 'w-60' : 'w-0',
                )}
            >
                <div className="w-60 flex flex-col h-full">
                    {navPanelInner}
                </div>
            </aside>

            {/* ─── Mobile Sheet ────────────────────────────────────────── */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="p-0 w-60" showCloseButton={false}>
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    {navPanelInner}
                </SheetContent>
            </Sheet>

            {/* ─── Panel 3: Main Content ───────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
                    {/* Mobile hamburger */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open navigation"
                    >
                        <Menu className="size-4" />
                    </Button>

                    {/* Desktop panel-2 toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hidden lg:flex"
                        onClick={toggleNav}
                        aria-label={navOpen ? 'Collapse navigation' : 'Expand navigation'}
                    >
                        {navOpen
                            ? <ChevronLeft className="size-4" />
                            : <ChevronRight className="size-4" />
                        }
                    </Button>

                    <span className="text-sm font-medium text-muted-foreground">
                        WebBriks Support Console
                    </span>
                </header>

                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
