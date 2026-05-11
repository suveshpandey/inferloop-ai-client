'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ApiRequestError } from '@/lib/api';

export default function SignupPage() {
    const auth = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (auth.status === 'authenticated') router.replace('/');
    }, [auth.status, router]);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await auth.signup(email, password, username.trim() || undefined);
            router.replace('/');
        } catch (err) {
            setError(
                err instanceof ApiRequestError
                    ? err.message
                    : 'Sign up failed. Please try again.',
            );
            setSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
            <div className="relative mx-auto flex w-full max-w-md flex-col px-6 py-20">
                {/* Heading */}
                <div className="animate-fade-up mb-8 space-y-3">
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        Create account
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight">Get started</h1>
                    <p className="text-sm text-muted-foreground">
                        Spin up an account to start running multi-agent reviews.
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
                            <Input
                                id="password"
                                type="password"
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

                        {error && (
                            <div
                                role="alert"
                                className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-300"
                            >
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={submitting}
                            className="h-10 w-full font-mono text-[15px]"
                        >
                            {submitting ? 'Creating account…' : 'Create account →'}
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
    );
}
