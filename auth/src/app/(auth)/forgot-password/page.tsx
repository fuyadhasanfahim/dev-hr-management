import type { Metadata } from 'next';
import BrandingPanel from '@/components/auth/branding-panel';
import ThemeToggle from '@/components/auth/theme-toggle';
import ForgotPasswordForm from './_forgot-password-form';

export const metadata: Metadata = {
    title: 'Reset Password | WebBriks',
};

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-svh flex">
            <BrandingPanel />
            <div className="flex-1 relative flex items-center justify-center p-4 lg:p-8 bg-background">
                <div className="absolute top-4 right-4">
                    <ThemeToggle />
                </div>
                <ForgotPasswordForm />
            </div>
        </div>
    );
}
