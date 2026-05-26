import type { Metadata } from 'next';
import BrandingPanel from '@/components/auth/branding-panel';
import ThemeToggle from '@/components/auth/theme-toggle';
import SignInForm from './_sign-in-form';

export const metadata: Metadata = {
    title: 'Sign In | WebBriks',
};

export default function SignInPage() {
    return (
        <div className="min-h-svh flex">
            <BrandingPanel />
            <div className="flex-1 relative flex items-center justify-center p-4 lg:p-8 bg-background">
                <div className="absolute top-4 right-4">
                    <ThemeToggle />
                </div>
                <SignInForm />
            </div>
        </div>
    );
}
