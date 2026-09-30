import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Leave',
    description: 'Manage staff leave applications',
};

export default function LeaveLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
