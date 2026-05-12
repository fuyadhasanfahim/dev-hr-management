'use client';
import * as React from 'react';
import { NavMain } from '@/components/sidebar/nav-main';
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import Image from 'next/image';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="w-auto h-auto mx-auto hover:bg-transparent"
                        >
                            <Link href="/">
                                <figure className="w-auto h-auto">
                                    <Image
                                        src="https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png"
                                        alt="Company logo"
                                        width={150}
                                        height={45}
                                        priority
                                        style={{ width: 'auto', height: 'auto' }}
                                        className="max-w-[150px] object-contain"
                                    />
                                </figure>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain />
            </SidebarContent>
        </Sidebar>
    );
}
