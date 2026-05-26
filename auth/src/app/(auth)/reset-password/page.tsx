import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import BrandingPanel from '@/components/auth/branding-panel';
import ThemeToggle from '@/components/auth/theme-toggle';
import ResetPasswordForm from './_reset-password-form';

export const metadata: Metadata = {
    title: 'New Password | WebBriks',
};

export default function ResetPasswordPage() {
    return (
        <div className="min-h-svh flex">
            <BrandingPanel />
            <div className="flex-1 relative flex items-center justify-center p-4 lg:p-8 bg-background">
                <div className="absolute top-4 right-4">
                    <ThemeToggle />
                </div>
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    }
                >
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </div>
    );
}
