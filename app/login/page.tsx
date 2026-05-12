'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AuthAside } from '@/components/AuthAside';
import { notifyError } from '@/lib/notify';
import { Spinner } from '@/components/ui/spinner';

export default function LoginPage() {
    const auth = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Already-logged-in users have no business on the login page — send them to /review.
    useEffect(() => {
        if (auth.status === 'authenticated') router.replace('/review');
    }, [auth.status, router]);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await auth.login(email, password);
            router.replace('/review');
        } catch (err) {
            notifyError(err, { description: 'Login failed. Check your credentials and try again.' });
            setSubmitting(false);
        }
    };

    return (
        <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-2">
            <AuthAside mode="login" />

            <div className="flex flex-col justify-center px-6 py-16">
              <div className="mx-auto flex w-full max-w-md flex-col">
                {/* Heading */}
                <div className="animate-fade-up mb-8 space-y-3">
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        Sign in
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight">Welcome back.</h1>
                    <p className="text-sm text-muted-foreground">
                        Log in to pick up where you left off.
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
                                htmlFor="password"
                                className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
                            >
                                Password
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
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
                                    Signing in…
                                </span>
                            ) : (
                                'Sign in →'
                            )}
                        </Button>
                    </form>
                </Card>

                {/* Switch link */}
                <p
                    className="animate-fade-up mt-6 text-center text-sm text-muted-foreground"
                    style={{ animationDelay: '240ms' }}
                >
                    Don&apos;t have an account?{' '}
                    <Link
                        href="/signup"
                        className="font-mono text-foreground underline-offset-4 hover:underline"
                    >
                        Sign up
                    </Link>
                </p>
              </div>
            </div>
        </div>
    );
}
