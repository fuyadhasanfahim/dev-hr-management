import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Notices',
    description: 'View company notices and announcements',
};

export default function NoticesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
