import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Debit',
    description: 'Manage debit transactions',
};

export default function DebitLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
