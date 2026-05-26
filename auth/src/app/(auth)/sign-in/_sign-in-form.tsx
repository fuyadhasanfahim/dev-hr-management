'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signIn, sendVerificationEmail, useSession } from '@/lib/auth-client';
import Logo from '@/components/logo';

const schema = z.object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_REDIRECT =
    process.env.NEXT_PUBLIC_DEFAULT_REDIRECT ?? 'https://webbriks.com';

function SignInContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || DEFAULT_REDIRECT;
    const successParam = searchParams.get('success');

    const { data: session, isPending } = useSession();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [resending, setResending] = useState(false);

    useEffect(() => {
        if (!isPending && session) {
            router.replace(callbackUrl);
        }
    }, [session, isPending, router, callbackUrl]);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: '', password: '' },
        mode: 'onBlur',
    });

    const isSubmitting = form.formState.isSubmitting;

    const onSubmit = async (data: FormValues) => {
        setError(null);
        setUnverifiedEmail(null);
        setResendSuccess(false);

        const res = await signIn.email({
            email: data.email,
            password: data.password,
            callbackURL: callbackUrl,
        });

        if (res.error) {
            if (res.error.code === 'EMAIL_NOT_VERIFIED') {
                setUnverifiedEmail(data.email);
            } else {
                setError(
                    res.error.message || 'Failed to sign in. Please try again.',
                );
            }
            return;
        }

        router.replace(callbackUrl);
    };

    const handleResendVerification = async () => {
        if (!unverifiedEmail) return;
        setResending(true);
        try {
            const res = await sendVerificationEmail({
                email: unverifiedEmail,
                callbackURL: `${process.env.NEXT_PUBLIC_AUTH_URL}/sign-in`,
            });
            if (res.error) {
                setError(
                    res.error.message ||
                        'Failed to resend verification email.',
                );
                return;
            }
            setResendSuccess(true);
        } catch {
            setError('Failed to resend verification email.');
        } finally {
            setResending(false);
        }
    };

    if (isPending || (!isPending && !!session)) {
        return (
            <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm animate-in fade-in duration-500 slide-in-from-bottom-4">
            <div className="flex justify-center mb-8 lg:hidden">
                <Logo />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Sign In</CardTitle>
                    <CardDescription>
                        Enter your credentials to access your account
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {successParam === 'account-created' && (
                        <Alert>
                            <AlertDescription>
                                Account created! Please sign in to continue.
                            </AlertDescription>
                        </Alert>
                    )}

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {unverifiedEmail && !resendSuccess && (
                        <Alert variant="destructive">
                            <AlertDescription className="flex flex-col gap-2">
                                <span>
                                    Your email is not verified. Please verify
                                    your email before signing in.
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleResendVerification}
                                    disabled={resending}
                                    className="w-fit"
                                >
                                    {resending && (
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    )}
                                    Resend Verification Email
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {resendSuccess && (
                        <Alert>
                            <AlertDescription>
                                Verification email sent! Please check your
                                inbox.
                            </AlertDescription>
                        </Alert>
                    )}

                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
                        <div className="space-y-1.5">
                            <Label htmlFor="email">
                                Email{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                disabled={isSubmitting}
                                {...form.register('email')}
                            />
                            {form.formState.errors.email && (
                                <p className="text-xs text-destructive">
                                    {form.formState.errors.email.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">
                                    Password{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs text-primary hover:underline"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    disabled={isSubmitting}
                                    {...form.register('password')}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    disabled={isSubmitting}
                                    aria-label={
                                        showPassword
                                            ? 'Hide password'
                                            : 'Show password'
                                    }
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            {form.formState.errors.password && (
                                <p className="text-xs text-destructive">
                                    {form.formState.errors.password.message}
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Sign In
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function SignInForm() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            }
        >
            <SignInContent />
        </Suspense>
    );
}
