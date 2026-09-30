import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import ReduxProvider from '@/components/providers/redux-provider';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
    title: 'WebBriks | Support',
    description: 'WebBriks HR Support Portal',
    icons: {
        icon: '/favicon.ico',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={cn('h-full antialiased', 'font-sans', "font-sans", inter.variable)}
        >
            <body className={cn('min-h-full flex flex-col', inter.variable)}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    <ReduxProvider>
                        <TooltipProvider>
                            {children}
                            <Toaster position="bottom-right" richColors closeButton />
                        </TooltipProvider>
                    </ReduxProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
