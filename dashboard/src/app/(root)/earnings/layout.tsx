import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Earnings',
    description: 'View and manage earnings',
};

export default function EarningsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
