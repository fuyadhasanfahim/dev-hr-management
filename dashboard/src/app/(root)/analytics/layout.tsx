import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Analytics',
    description: 'Finance analytics and reporting dashboard',
};

export default function AnalyticsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
