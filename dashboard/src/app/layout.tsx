import './globals.css';
import { cn } from '@/lib/utils';
import Main from '@/components/providers/main';
import { Metadata } from 'next';
import { Inter } from 'next/font/google';

const fontSans = Inter({
    subsets: ['latin'],
    variable: '--font-sans',
});

export const metadata: Metadata = {
    // Every page names itself first so the tab says where you are:
    // "Leads | Dashboard | WebBriks - Global Creative Agency".
    title: {
        template: '%s | Dashboard | WebBriks - Global Creative Agency',
        default: 'Dashboard | WebBriks - Global Creative Agency',
    },
    description: 'HR Management - Web Briks LLC',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={cn(
                    'font-sans',
                    'antialiased',
                    fontSans.variable,
                )}
            >
                <Main>{children}</Main>
            </body>
        </html>
    );
}
