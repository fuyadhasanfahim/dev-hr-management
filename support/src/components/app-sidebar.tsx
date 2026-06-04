'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    Ticket,
    MessageCircle,
    // Users,
    // Settings,
} from 'lucide-react';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarInput,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import Logo from '@/components/logo';

const navItems = [
    {
        title: 'Overview',
        url: '/dashboard',
        icon: LayoutDashboard,
        description: 'Support dashboard and key metrics',
    },
    {
        title: 'Tickets',
        url: '/tickets',
        icon: Ticket,
        description: 'Manage and respond to support tickets',
    },
    {
        title: 'Live Chat',
        url: '/live-chat',
        icon: MessageCircle,
        description: 'Handle real-time customer chat sessions',
    },
    // {
    //     title: 'Clients',
    //     url: '/clients',
    //     icon: Users,
    //     description: 'View and manage client information',
    // },
    // {
    //     title: 'Settings',
    //     url: '/settings',
    //     icon: Settings,
    //     description: 'Configure support preferences',
    // },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname();
    const { setOpen } = useSidebar();

    const activeItem =
        navItems.find((item) => pathname.startsWith(item.url)) ?? navItems[0];

    return (
        <Sidebar
            collapsible="icon"
            className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
            {...props}
        >
            {/* Left icon rail */}
            <Sidebar
                collapsible="none"
                className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
            >
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                size="lg"
                                asChild
                                className="md:h-8 md:p-0"
                            >
                                <Link href="/dashboard">
                                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                        <span className="text-xs font-bold">
                                            W
                                        </span>
                                    </div>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-medium">
                                            WebBriks
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            Support
                                        </span>
                                    </div>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>

                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupContent className="px-1.5 md:px-0">
                            <SidebarMenu>
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname.startsWith(
                                        item.url,
                                    );
                                    return (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton
                                                tooltip={{
                                                    children: item.title,
                                                    hidden: false,
                                                }}
                                                isActive={isActive}
                                                className="px-2.5 md:px-2"
                                                asChild
                                                onClick={() => setOpen(true)}
                                            >
                                                <Link href={item.url}>
                                                    <Icon className="size-4" />
                                                    <span>{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>

                <SidebarFooter>
                    <NavUser />
                </SidebarFooter>
            </Sidebar>

            {/* Right secondary panel */}
            <Sidebar collapsible="none" className="hidden flex-1 md:flex">
                <SidebarHeader className="gap-3.5 border-b p-4">
                    <div className="flex items-center justify-between">
                        <Logo />
                    </div>
                    <SidebarInput
                        placeholder={`Search ${activeItem.title.toLowerCase()}...`}
                    />
                </SidebarHeader>

                <SidebarContent>
                    <SidebarGroup className="px-0">
                        <SidebarGroupContent>
                            <div className="p-4 space-y-1">
                                <p className="text-base font-semibold text-foreground">
                                    {activeItem.title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {activeItem.description}
                                </p>
                            </div>

                            <div className="px-4 space-y-2">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname.startsWith(
                                        item.url,
                                    );
                                    return (
                                        <Link
                                            key={item.url}
                                            href={item.url}
                                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                                                isActive
                                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                                    : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground'
                                            }`}
                                        >
                                            <Icon className="size-4 shrink-0" />
                                            <div>
                                                <p className="font-medium">
                                                    {item.title}
                                                </p>
                                                <p
                                                    className={`text-xs ${isActive ? 'text-sidebar-primary-foreground/70' : 'text-muted-foreground'}`}
                                                >
                                                    {item.description}
                                                </p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
        </Sidebar>
    );
}
