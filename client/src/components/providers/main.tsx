'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from './theme-provider';
import { Toaster } from '@/components/ui/sonner';
import ReduxProvider from './ReduxProvider';
import { useSession } from '@/lib/auth-client';
import { ToasterProps } from 'sonner';
import AuthGuard from './AuthGuard';
import { SocketProvider } from '@/contexts/SocketContext';
import { GlobalPolicyPrompt } from '@/components/policy/GlobalPolicyPrompt';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const originalError = console.error;
    console.error = (...args) => {
        if (
            typeof args[0] === 'string' &&
            args[0].includes(
                'Encountered a script tag while rendering React component',
            )
        ) {
            return;
        }
        originalError.apply(console, args);
    };
}

export default function Main({ children }: { children: ReactNode }) {
    const { data } = useSession();

    const theme = (data?.user?.theme as ToasterProps['theme']) || 'system';

    return (
        <AuthGuard>
            <ReduxProvider>
                <ThemeProvider
                    attribute="class"
                    defaultTheme={theme}
                    enableSystem
                    disableTransitionOnChange
                >
                    <SocketProvider>
                        {children}
                        <GlobalPolicyPrompt />
                    </SocketProvider>
                    <Toaster
                        theme={theme}
                        position="bottom-right"
                        closeButton
                    />
                </ThemeProvider>
            </ReduxProvider>
        </AuthGuard>
    );
}
