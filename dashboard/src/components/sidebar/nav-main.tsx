"use client";

import React from "react";
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarInput,
    useSidebar,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { sidebarGroups } from "@/constants/sidebar";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "../ui/skeleton";
import { Role } from "@/constants/role";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

import { useGetMeQuery } from "@/redux/features/staff/staffApi";

export function NavMain() {
    const {
        data: session,
        isPending: isSessionPending,
        isRefetching,
    } = useSession();
    const { data: meData, isLoading: isMeLoading } = useGetMeQuery({});
    const pathname = usePathname();
    const { state } = useSidebar();

    const [searchQuery, setSearchQuery] = React.useState("");

    const userRole = session?.user?.role as Role | undefined;
    const staff = meData?.staff;

    // Filter items based on user role, designation, and search query
    const filteredGroups = React.useMemo(() => {
        return sidebarGroups.map(group => {
            const filteredItems = group.items.filter((item) => {
                if (!userRole) return false;
                if (!item.access.includes(userRole)) return false;

                // Restriction: STAFF must match requiredDesignation if specified
                if (
                    (userRole === Role.STAFF) &&
                    item.requiredDesignation
                ) {
                    if (
                        staff?.designation?.toLowerCase() !==
                        item.requiredDesignation.toLowerCase()
                    ) {
                        return false;
                    }
                }

                // Search query filter
                if (searchQuery.trim() !== "") {
                    return item.title.toLowerCase().includes(searchQuery.toLowerCase());
                }

                return true;
            });

            return {
                ...group,
                items: filteredItems,
            };
        }).filter(group => group.items.length > 0);
    }, [userRole, staff, searchQuery]);

    const allGroupLabels = React.useMemo(
        () => sidebarGroups.map((g) => g.groupLabel),
        []
    );

    // Accordion expanded values — all groups open by default
    const [expandedItems, setExpandedItems] = React.useState<string[]>(allGroupLabels);

    // Auto-expand all matching categories when searching; reset to all groups open when cleared
    React.useEffect(() => {
        if (searchQuery.trim() !== "") {
            setExpandedItems(filteredGroups.map(g => g.groupLabel));
        } else {
            setExpandedItems(allGroupLabels);
        }
    }, [searchQuery, filteredGroups, allGroupLabels]);

    const isLoading =
        isSessionPending || isMeLoading || (isRefetching && !session);

    if (isLoading) {
        return (
            <SidebarGroup className="px-4">
                <SidebarMenu className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                        <SidebarMenuItem key={i}>
                            <Skeleton className="h-8 w-full bg-muted animate-pulse" />
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroup>
        );
    }

    // Render simple flat lists when sidebar is collapsed (collapsed as icon)
    if (state === "collapsed") {
        return (
            <SidebarGroup className="py-0">
                <SidebarMenu className="space-y-1">
                    {filteredGroups.flatMap(g => g.items).map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                tooltip={item.title}
                                className={cn(
                                    !item.external && pathname.startsWith(item.url) &&
                                        "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                                )}
                                asChild
                            >
                                {item.external ? (
                                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                                        {item.icon && (
                                            <item.icon
                                                strokeWidth={2}
                                                className="size-4 shrink-0"
                                            />
                                        )}
                                        <span>{item.title}</span>
                                    </a>
                                ) : (
                                    <Link href={item.url}>
                                        {item.icon && (
                                            <item.icon
                                                strokeWidth={2}
                                                className="size-4 shrink-0"
                                            />
                                        )}
                                        <span>{item.title}</span>
                                    </Link>
                                )}
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroup>
        );
    }

    return (
        <div className="flex flex-col gap-3 py-2">
            {/* Search Input */}
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
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 p-0.5 rounded-full hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                            aria-label="Clear search"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>
            </SidebarGroup>

            {/* Accordion Categories */}
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
                        className="w-full space-y-1.5 border-none"
                    >
                        {filteredGroups.map((group) => (
                            <AccordionItem
                                key={group.groupLabel}
                                value={group.groupLabel}
                                className="border-none"
                            >
                                <AccordionTrigger className="hover:no-underline py-1 px-3 text-[10px] font-bold text-sidebar-foreground/55 hover:text-sidebar-foreground transition-colors uppercase tracking-wider rounded-md hover:bg-sidebar-accent/30 [&[data-state=open]>svg]:rotate-180">
                                    <span className="flex items-center gap-2">
                                        {group.groupLabel}
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent className="pb-0 pt-1 px-1">
                                    <SidebarMenu className="space-y-0.5">
                                        {group.items.map((item) => (
                                            <SidebarMenuItem key={item.title}>
                                                <SidebarMenuButton
                                                    tooltip={item.title}
                                                    className={cn(
                                                        !item.external && pathname.startsWith(item.url) &&
                                                            "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-medium",
                                                    )}
                                                    asChild
                                                >
                                                    {item.external ? (
                                                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                                                            {item.icon && (
                                                                <item.icon
                                                                    strokeWidth={2}
                                                                    className="size-4 shrink-0"
                                                                />
                                                            )}
                                                            <span>{item.title}</span>
                                                        </a>
                                                    ) : (
                                                        <Link href={item.url}>
                                                            {item.icon && (
                                                                <item.icon
                                                                    strokeWidth={2}
                                                                    className="size-4 shrink-0"
                                                                />
                                                            )}
                                                            <span>{item.title}</span>
                                                        </Link>
                                                    )}
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
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
