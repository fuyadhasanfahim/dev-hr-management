'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import Logo from '@/components/logo';

interface InvitationData {
    email: string;
    role: string;
    department?: string;
    designation: string;
    salary?: number;
}

const schema = z
    .object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    });

type FormValues = z.infer<typeof schema>;

interface SignUpFormProps {
    token: string;
}

export default function SignUpForm({ token }: SignUpFormProps) {
    const router = useRouter();

    const [invitation, setInvitation] = useState<InvitationData | null>(null);
    const [validating, setValidating] = useState(true);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!token) {
            setValidationError('Invalid invitation link.');
            setValidating(false);
            return;
        }

        const validate = async () => {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_APP_URL}/api/invitations/${token}/validate`,
                );
                const data = await res.json();

                if (!res.ok || !data.success) {
                    setValidationError(
                        data.message ||
                            'This invitation link is invalid or has expired.',
                    );
                    return;
                }

                setInvitation(data.data);
            } catch {
                setValidationError(
                    'Failed to validate invitation. Please try again.',
                );
            } finally {
                setValidating(false);
            }
        };

        validate();
    }, [token]);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { name: '', password: '', confirmPassword: '' },
        mode: 'onBlur',
    });

    const isSubmitting = form.formState.isSubmitting;

    const onSubmit = async (data: FormValues) => {
        setSubmitError(null);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_APP_URL}/api/invitations/${token}/accept`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: data.name,
                        password: data.password,
                    }),
                },
            );

            const result = await res.json();

            if (!res.ok || !result.success) {
                setSubmitError(
                    result.message ||
                        'Failed to create account. Please try again.',
                );
                return;
            }

            const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || '';
            router.replace(`/sign-in?success=account-created&callbackUrl=${encodeURIComponent(dashboardUrl)}`);
        } catch {
            setSubmitError('Something went wrong. Please try again.');
        }
    };

    if (validating) {
        return (
            <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (validationError) {
        return (
            <div className="w-full max-w-sm animate-in fade-in duration-500 slide-in-from-bottom-4">
                <div className="flex justify-center mb-8 lg:hidden">
                    <Logo />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-destructive">
                            Invalid Invitation
                        </CardTitle>
                        <CardDescription>{validationError}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/sign-in">
                            <Button variant="outline" className="w-full">
                                Back to Sign In
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
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
                    <CardTitle>Complete Registration</CardTitle>
                    <CardDescription>
                        You&apos;ve been invited as{' '}
                        <strong>{invitation?.designation}</strong>
                        {invitation?.department && (
                            <> in {invitation.department}</>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {submitError && (
                        <Alert variant="destructive">
                            <AlertDescription>{submitError}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input
                            value={invitation?.email ?? ''}
                            readOnly
                            disabled
                            className="bg-muted/50"
                        />
                    </div>

                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-4"
                    >
                        <div className="space-y-1.5">
                            <Label htmlFor="name">
                                Full Name{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder="Enter your full name"
                                disabled={isSubmitting}
                                {...form.register('name')}
                            />
                            {form.formState.errors.name && (
                                <p className="text-xs text-destructive">
                                    {form.formState.errors.name.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password">
                                Password{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Create a password"
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
                                placeholder="Confirm your password"
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
                            Create Account
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
