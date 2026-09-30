import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Careers',
    description: 'Manage job applications',
};

export default function CareersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
