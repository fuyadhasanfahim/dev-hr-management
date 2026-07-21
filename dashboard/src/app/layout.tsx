import './globals.css';
import { cn } from '@/lib/utils';
import Main from '@/components/providers/main';
import { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
});

export const metadata: Metadata = {
    title: 'HR Management - Web Briks LLC',
    description: 'HR Management - Web Briks LLC',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={inter.variable}>
            <body className={cn('font-sans antialiased')}>
                <Main>{children}</Main>
            </body>
        </html>
    );
}
