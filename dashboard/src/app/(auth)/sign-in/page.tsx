import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader } from 'lucide-react';
import SigninForm from '@/components/auth/sign-in';

export const metadata: Metadata = {
    title: 'Sign In | WebBriks',
};

export default function SigninPage() {
    return (
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-md">
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center py-10">
                            <Loader className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    }
                >
                    <SigninForm />
                </Suspense>
            </div>
        </div>
    );
}
