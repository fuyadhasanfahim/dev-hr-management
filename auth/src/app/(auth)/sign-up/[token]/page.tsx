import type { Metadata } from 'next';
import BrandingPanel from '@/components/auth/branding-panel';
import ThemeToggle from '@/components/auth/theme-toggle';
import SignUpForm from './_sign-up-form';

export const metadata: Metadata = {
    title: 'Create Account | WebBriks',
};

export default async function SignUpPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;

    return (
        <div className="min-h-svh flex">
            <BrandingPanel />
            <div className="flex-1 relative flex items-center justify-center p-4 lg:p-8 bg-background">
                <div className="absolute top-4 right-4">
                    <ThemeToggle />
                </div>
                <SignUpForm token={token} />
            </div>
        </div>
    );
}
