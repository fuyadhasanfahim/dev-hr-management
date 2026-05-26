'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
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
import { requestPasswordReset } from '@/lib/auth-client';

const schema = z.object({
    email: z.string().email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: '' },
        mode: 'onBlur',
    });

    const isSubmitting = form.formState.isSubmitting;

    const onSubmit = async (data: FormValues) => {
        setError(null);
        try {
            await requestPasswordReset({
                email: data.email,
                redirectTo: `${process.env.NEXT_PUBLIC_AUTH_URL}/reset-password`,
            });
            setSubmitted(true);
        } catch {
            setError('Something went wrong. Please try again.');
        }
    };

    if (submitted) {
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
                        <div className="flex items-center justify-center mb-2">
                            <MailCheck className="h-10 w-10 text-primary" />
                        </div>
                        <CardTitle className="text-center">
                            Check Your Email
                        </CardTitle>
                        <CardDescription className="text-center">
                            If an account with that email exists, we&apos;ve
                            sent a password reset link. Please check your inbox
                            and spam folder.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Link href="/sign-in">
                            <Button variant="default" className="w-full">
                                Back to Sign In
                            </Button>
                        </Link>
                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => setSubmitted(false)}
                        >
                            Try another email
                        </Button>
                    </CardContent>
                </Card>
            </div>
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
                    <div className="flex items-center gap-2 mb-1">
                        <Link
                            href="/sign-in"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Back to sign in"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <CardTitle>Forgot Password?</CardTitle>
                    </div>
                    <CardDescription>
                        Enter your email address and we&apos;ll send you a link
                        to reset your password.
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

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Send Reset Link
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
