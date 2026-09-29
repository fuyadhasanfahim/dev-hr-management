'use client';

import { usePathname } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

const PAGE_TITLES: Record<string, string> = {
    '/dashboard': 'Overview',
    '/live-chat': 'Live Chat',
    '/messages': 'Your Messages',
    '/tickets': 'Tickets',
    '/clients': 'Clients',
    '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
    const match = Object.keys(PAGE_TITLES).find((url) => pathname === url || pathname.startsWith(url + '/'));
    return match ? PAGE_TITLES[match] : 'Support Console';
}

export function SiteHeader() {
    const pathname = usePathname();
    const title = getPageTitle(pathname);

    return (
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="ml-1" />
                <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
                <h1 className="text-base font-medium">{title}</h1>
            </div>
        </header>
    );
}
