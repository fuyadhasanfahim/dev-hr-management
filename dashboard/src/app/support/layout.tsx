import React from 'react';
import { ChatWidget } from '../../components/live-chat/chat-widget';
import { Headset } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
    title: 'Client Support Portal - Dev-HR',
    description: 'Dev-HR customer ticketing system and live chat assistance.',
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans text-foreground">
            {/* Header Navigation Bar */}
            <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
                <div className="container mx-auto px-4 h-14 flex items-center justify-between">
                    <Link href="/support" className="flex items-center gap-2 font-bold hover:opacity-90 select-none">
                        <div className="p-1.5 rounded-lg bg-primary text-primary-foreground border border-primary/20">
                            <Headset className="w-4 h-4" />
                        </div>
                        <span className="text-sm tracking-tight">Dev-HR Support Center</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/sign-in"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-semibold"
                        >
                            Sign In to Account
                        </Link>
                    </div>
                </div>
            </header>

            {/* Support Core Pages */}
            <main className="flex-1 flex flex-col min-h-0 container mx-auto px-4 py-6 max-w-5xl">
                {children}
            </main>

            {/* Global Live Chat Launcher Widget */}
            <ChatWidget />
        </div>
    );
}
