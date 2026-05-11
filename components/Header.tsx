'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, buttonVariants } from '@/components/ui/button';

export function Header() {
    const auth = useAuth();

    return (
        <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
                <Link
                    href="/"
                    className="group flex items-baseline gap-0 font-mono text-base font-semibold tracking-tight transition-opacity hover:opacity-80"
                >
                    <span>InferLoop</span>
                    <span className="text-muted-foreground transition-colors group-hover:text-foreground">.ai</span>
                </Link>

                <nav className="flex items-center gap-2">
                    {auth.status === 'loading' && (
                        <div className="h-7 w-28 rounded-md bg-muted animate-pulse" />
                    )}

                    {auth.status === 'unauthenticated' && (
                        <>
                            <Link href="/login" className={`${buttonVariants({ variant: 'ghost' })} font-mono text-[15px] h-9 px-3.5`}>
                                Log in
                            </Link>
                            <Link href="/signup" className={`${buttonVariants()} font-mono text-[15px] h-9 px-3.5`}>
                                Sign up
                            </Link>
                        </>
                    )}

                    {auth.status === 'authenticated' && (
                        <>
                            <span className="hidden font-mono text-sm text-muted-foreground sm:inline">
                                {auth.user.email}
                            </span>
                            <Button variant="outline" onClick={() => auth.logout()} className="font-mono text-[15px] h-9 px-3.5">
                                Log out
                            </Button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
