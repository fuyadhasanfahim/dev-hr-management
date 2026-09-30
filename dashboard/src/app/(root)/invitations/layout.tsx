import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Invitations',
    description: 'Manage team invitations',
};

export default function InvitationsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
