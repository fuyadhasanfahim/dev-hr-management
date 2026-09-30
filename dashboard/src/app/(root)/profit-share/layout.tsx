import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Profit Share',
    description: 'Manage profit sharing and transfers',
};

export default function ProfitShareLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
