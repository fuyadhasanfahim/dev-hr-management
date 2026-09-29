'use client';

import { PanelLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

// Shown permanently once the sidebar is hidden (or on mobile, where it's the
// only way to open it) — the in-sidebar trigger disappears along with the
// sidebar itself, so this one lives in the main content area instead.
export function SidebarFloatingTrigger() {
    const { state, isMobile, toggleSidebar } = useSidebar();
    const visible = isMobile || state === 'collapsed';

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={toggleSidebar}
            className={cn(
                'fixed top-4 left-4 z-20 bg-sidebar shadow-sm transition-opacity',
                visible ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
        >
            <PanelLeftIcon />
            <span className="sr-only">Toggle Sidebar</span>
        </Button>
    );
}
