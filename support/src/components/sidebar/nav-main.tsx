'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CalendarCheck, LayoutDashboard, MessageCircle, MessageSquare, Search, Settings, Target, Ticket, Users, X } from 'lucide-react';
import {
    SidebarGroup,
    SidebarInput,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLiveCounts } from '@/hooks/use-live-counts';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

interface NavItem {
    title: string;
    url: string;
    icon: React.ElementType;
    permission?: string; // Hidden unless the user holds it (the API enforces it too).
}

interface NavGroup {
    groupLabel: string;
    items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        groupLabel: 'Main',
        items: [
            { title: 'Overview', url: '/dashboard', icon: LayoutDashboard },
            { title: 'Live Chat', url: '/live-chat', icon: MessageSquare },
            { title: 'Messages', url: '/messages', icon: MessageCircle, permission: 'support.access' },
        ],
    },
    {
        groupLabel: 'Sales',
        items: [
            { title: 'Leads', url: '/leads', icon: Target, permission: 'lead.read' },
            { title: 'Consultations', url: '/consultations', icon: CalendarCheck, permission: 'consultation.read' },
            { title: 'Clients', url: '/clients', icon: Users, permission: 'client.read' },
        ],
    },
    {
        groupLabel: 'Support',
        items: [
            { title: 'Tickets', url: '/tickets', icon: Ticket },
            { title: 'Knowledge Base', url: '/knowledge-base', icon: BookOpen },
        ],
    },
    {
        groupLabel: 'System',
        items: [{ title: 'Settings', url: '/settings', icon: Settings }],
    },
];

const ALL_GROUP_LABELS = NAV_GROUPS.map((g) => g.groupLabel);

// Solid red count pill — reads as "needs attention" on any item, including the active purple one.
function CountBadge({ count }: { count: number }) {
    return (
        <SidebarMenuBadge className="bg-destructive text-white tabular-nums peer-hover/menu-button:text-white peer-data-active/menu-button:text-white">
            {count > 99 ? '99+' : count}
        </SidebarMenuBadge>
    );
}

export function NavMain() {
    const pathname = usePathname();
    const { state } = useSidebar();
    const { liveChatCount, ticketCount, messagesUnreadCount } = useLiveCounts();
    const badgeByUrl: Record<string, number> = {
        '/live-chat': liveChatCount,
        '/tickets': ticketCount,
        '/messages': messagesUnreadCount,
    };

    const [searchQuery, setSearchQuery] = React.useState('');
    const { can } = usePermissions();

    const filteredGroups = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return NAV_GROUPS.map((group) => ({
            ...group,
            items: group.items.filter(
                (item) => (!item.permission || can(item.permission)) && (!q || item.title.toLowerCase().includes(q)),
            ),
        })).filter((group) => group.items.length > 0);
    }, [searchQuery, can]);

    const [expandedItems, setExpandedItems] = React.useState<string[]>(ALL_GROUP_LABELS);

    React.useEffect(() => {
        setExpandedItems(searchQuery.trim() !== '' ? filteredGroups.map((g) => g.groupLabel) : ALL_GROUP_LABELS);
    }, [searchQuery, filteredGroups]);

    function isActive(url: string) {
        return pathname === url || pathname.startsWith(url + '/');
    }

    // Flat list when the sidebar is collapsed to icons.
    if (state === 'collapsed') {
        return (
            <SidebarGroup className="py-0">
                <SidebarMenu className="space-y-1">
                    {filteredGroups.flatMap((g) => g.items).map((item) => {
                        const badge = badgeByUrl[item.url] ?? 0;
                        return (
                            <SidebarMenuItem key={item.url}>
                                <SidebarMenuButton
                                    tooltip={item.title}
                                    className={cn(
                                        isActive(item.url) &&
                                            'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                                    )}
                                    asChild
                                >
                                    <Link href={item.url}>
                                        <item.icon className="size-4 shrink-0" />
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                                {badge > 0 && <CountBadge count={badge} />}
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroup>
        );
    }

    return (
        <div className="flex flex-col gap-3 py-2">
            <SidebarGroup className="py-0 px-3">
                <div className="relative flex items-center">
                    <Search className="absolute left-2.5 size-4 text-sidebar-foreground/50 pointer-events-none" />
                    <SidebarInput
                        type="text"
                        placeholder="Search navigation..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-8 h-9 w-full bg-sidebar-accent/50 border-sidebar-border/50 text-xs rounded-md focus-visible:ring-1 focus-visible:ring-sidebar-ring focus-visible:bg-background transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 p-0.5 rounded-full hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>
            </SidebarGroup>

            <SidebarGroup className="py-0">
                {filteredGroups.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-center text-sidebar-foreground/40 font-medium">
                        No matching items
                    </div>
                ) : (
                    <Accordion
                        type="multiple"
                        value={expandedItems}
                        onValueChange={setExpandedItems}
                        className="w-full space-y-1.5 rounded-none border-none bg-transparent"
                    >
                        {filteredGroups.map((group) => (
                            <AccordionItem
                                key={group.groupLabel}
                                value={group.groupLabel}
                                className="border-none bg-transparent data-open:bg-transparent"
                            >
                                <AccordionTrigger className="no-underline hover:no-underline py-1 px-3 text-[10px] font-bold text-sidebar-foreground/55 hover:text-sidebar-foreground transition-colors uppercase tracking-wider [&[data-state=open]>svg]:rotate-180">
                                    <span className="flex items-center gap-2">{group.groupLabel}</span>
                                </AccordionTrigger>
                                <AccordionContent className="pb-0 pt-1 px-1 [&_a]:no-underline [&_a]:hover:no-underline">
                                    <SidebarMenu className="space-y-0.5">
                                        {group.items.map((item) => {
                                            const badge = badgeByUrl[item.url] ?? 0;
                                            return (
                                                <SidebarMenuItem key={item.url}>
                                                    <SidebarMenuButton
                                                        tooltip={item.title}
                                                        className={cn(
                                                            isActive(item.url) &&
                                                                'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-medium',
                                                        )}
                                                        asChild
                                                    >
                                                        <Link href={item.url}>
                                                            <item.icon className="size-4 shrink-0" />
                                                            <span>{item.title}</span>
                                                        </Link>
                                                    </SidebarMenuButton>
                                                    {badge > 0 && <CountBadge count={badge} />}
                                                </SidebarMenuItem>
                                            );
                                        })}
                                    </SidebarMenu>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </SidebarGroup>
        </div>
    );
}
