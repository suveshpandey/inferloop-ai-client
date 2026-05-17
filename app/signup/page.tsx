'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AuthAside } from '@/components/AuthAside';
import { notifyError } from '@/lib/notify';
import { Spinner } from '@/components/ui/spinner';

export default function SignupPage() {
    const auth = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (auth.status === 'authenticated') router.replace('/review');
    }, [auth.status, router]);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await auth.signup(email, password, username.trim() || undefined);
            router.replace('/review');
        } catch (err) {
            notifyError(err, { description: 'Sign up failed. Please try again.' });
            setSubmitting(false);
        }
    };

    return (
        <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
            <AuthAside mode="signup" />

            <div className="flex flex-col justify-center px-6 py-16">
              <div className="mx-auto flex w-full max-w-md flex-col">
                {/* Heading */}
                <div className="animate-fade-up mb-8 space-y-3">
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        Create account
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight">Get started.</h1>
                    <p className="text-sm text-muted-foreground">
                        Set up an account in seconds — your first review is moments away.
                    </p>
                </div>

                {/* Form card */}
                <Card
                    className="animate-fade-up gap-0 bg-card/50 p-6"
                    style={{ animationDelay: '120ms' }}
                >
                    <form onSubmit={onSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label
                                htmlFor="email"
                                className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
                            >
                                Email
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={submitting}
                                className="h-10 font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="username"
                                className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground"
                            >
                                <span>Username</span>
                                <span className="text-[10px] tracking-wider text-muted-foreground/60">
                                    optional
                                </span>
                            </Label>
                            <Input
                                id="username"
                                type="text"
                                autoComplete="username"
                                placeholder="taylor"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={submitting}
                                className="h-10 font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label
                                htmlFor="password"
                                className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
                            >
                                Password
                            </Label>
                            <PasswordInput
                                id="password"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                placeholder="At least 8 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={submitting}
                                className="h-10 font-mono"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={submitting}
                            className="h-10 w-full font-mono text-[15px]"
                        >
                            {submitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Spinner size="sm" />
                                    Creating account…
                                </span>
                            ) : (
                                'Create account →'
                            )}
                        </Button>
                    </form>
                </Card>

                {/* Switch link */}
                <p
                    className="animate-fade-up mt-6 text-center text-sm text-muted-foreground"
                    style={{ animationDelay: '240ms' }}
                >
                    Already have an account?{' '}
                    <Link
                        href="/login"
                        className="font-mono text-foreground underline-offset-4 hover:underline"
                    >
                        Log in
                    </Link>
                </p>
              </div>
            </div>
        </div>
    );
}
