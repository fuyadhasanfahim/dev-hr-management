import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Organization Settings',
    description: 'Manage departments, designations, and company branches',
};

export default function OrganizationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
