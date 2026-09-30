import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Attendance',
    description: 'Manage staff attendance records',
};

export default function AttendanceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
