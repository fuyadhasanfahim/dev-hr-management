import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import ReduxProvider from '@/components/providers/redux-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

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
            className={cn('h-full antialiased', inter.variable, 'font-sans')}
        >
            <body className="min-h-full flex flex-col">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                >
                    <ReduxProvider>
                        <TooltipProvider>
                            {children}
                        </TooltipProvider>
                    </ReduxProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
