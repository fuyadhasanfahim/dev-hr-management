'use client';

import { Suspense, useState } from 'react';
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
import { resetPassword } from '@/lib/auth-client';

const schema = z
    .object({
        password: z.string().min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    });

type FormValues = z.infer<typeof schema>;

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { password: '', confirmPassword: '' },
        mode: 'onBlur',
    });

    const isSubmitting = form.formState.isSubmitting;

    const onSubmit = async (data: FormValues) => {
        if (!token) return;
        setError(null);

        const res = await resetPassword({
            newPassword: data.password,
            token,
        });

        if (res.error) {
            setError(
                res.error.message ||
                    'Failed to reset password. The link may have expired.',
            );
            return;
        }

        router.replace('/sign-in');
    };

    if (!token) {
        return (
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-destructive">
                        Invalid Reset Link
                    </CardTitle>
                    <CardDescription>
                        This password reset link is invalid or has expired.
                        Please request a new one.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/forgot-password">
                        <Button className="w-full">
                            Request New Reset Link
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="w-full max-w-sm">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-primary">
                    WebBriks
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    HR Management Platform
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Reset Password</CardTitle>
                    <CardDescription>
                        Enter your new password below.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
                        <div className="space-y-1.5">
                            <Label htmlFor="password">
                                New Password{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter new password"
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

                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword">
                                Confirm Password{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="confirmPassword"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Confirm new password"
                                disabled={isSubmitting}
                                {...form.register('confirmPassword')}
                            />
                            {form.formState.errors.confirmPassword && (
                                <p className="text-xs text-destructive">
                                    {form.formState.errors.confirmPassword
                                        .message}
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
                            Reset Password
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            }
        >
            <ResetPasswordContent />
        </Suspense>
    );
}
