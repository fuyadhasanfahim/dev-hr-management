'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    useGetUnreadNotificationCountQuery,
    useGetNotificationsQuery,
    useMarkNotificationAsReadMutation,
    useMarkAllNotificationsAsReadMutation,
    type Notification,
} from '@/store/api/notificationApi';
import { cn } from '@/lib/utils';

function formatTimeAgo(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
}

function NotificationItem({
    notification,
    onMarkRead,
}: {
    notification: Notification;
    onMarkRead: (id: string) => void;
}) {
    return (
        <button
            onClick={() => {
                if (!notification.isRead) onMarkRead(notification._id);
                if (notification.actionUrl) {
                    window.location.href = notification.actionUrl;
                }
            }}
            className={cn(
                'w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border/50 last:border-0',
                !notification.isRead && 'bg-primary/5',
            )}
        >
            <div className="flex items-start gap-2">
                {!notification.isRead && (
                    <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                )}
                <div className={cn('flex-1 min-w-0', notification.isRead && 'ml-3.5')}>
                    <p className="text-[13px] font-medium truncate">{notification.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatTimeAgo(notification.createdAt)}</p>
                </div>
            </div>
        </button>
    );
}

export function NotificationDropdown() {
    const [open, setOpen] = useState(false);
    const { data: unreadCount = 0 } = useGetUnreadNotificationCountQuery(undefined, {
        pollingInterval: 30_000,
    });
    const { data: notifications = [], isLoading } = useGetNotificationsQuery(
        { limit: 20, skip: 0 },
        { skip: !open },
    );
    const [markAsRead] = useMarkNotificationAsReadMutation();
    const [markAllAsRead, { isLoading: isMarkingAll }] = useMarkAllNotificationsAsReadMutation();

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                    <Bell className="size-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center leading-none">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] p-0" sideOffset={8}>
                <div className="flex items-center justify-between px-3 py-2.5 border-b">
                    <h4 className="text-sm font-semibold">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] gap-1 text-muted-foreground"
                            onClick={() => markAllAsRead()}
                            disabled={isMarkingAll}
                        >
                            {isMarkingAll ? (
                                <Loader2 className="size-3 animate-spin" />
                            ) : (
                                <CheckCheck className="size-3" />
                            )}
                            Mark all read
                        </Button>
                    )}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Check className="size-5 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">All caught up!</p>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <NotificationItem
                                key={n._id}
                                notification={n}
                                onMarkRead={(id) => markAsRead(id)}
                            />
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
