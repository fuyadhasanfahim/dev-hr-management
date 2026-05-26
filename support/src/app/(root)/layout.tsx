import AppLayout from '@/components/layout/app-layout';
import AuthGuard from '@/components/providers/auth-guard';

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            <AppLayout>
                {children}
            </AppLayout>
        </AuthGuard>
    );
}
