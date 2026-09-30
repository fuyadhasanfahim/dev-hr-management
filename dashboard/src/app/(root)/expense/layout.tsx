import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Expenses',
    description: 'Manage business expenses',
};

export default function ExpenseLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
