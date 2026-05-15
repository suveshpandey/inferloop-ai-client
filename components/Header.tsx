'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { buttonVariants } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserMenu } from '@/components/UserMenu';

// Routes that render inside the (app) shell. The hamburger only appears
// (mobile-only) on these — there's no sidebar to open elsewhere.
const APP_ROUTE_PREFIXES = ['/review', '/profile', '/history'];

function isAppRoute(pathname: string): boolean {
    return APP_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function Header() {
    const auth = useAuth();
    const pathname = usePathname();
    const { toggle } = useSidebar();
    const showHamburger = isAppRoute(pathname) && auth.status === 'authenticated';

    return (
        <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
                <div className="flex items-center gap-2">
                    {showHamburger && (
                        <button
                            type="button"
                            onClick={toggle}
                            aria-label="Open navigation"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
                        >
                            <Menu className="h-4 w-4" />
                        </button>
                    )}
                    <Link
                        href="/"
                        className="group flex items-baseline gap-0 font-mono text-base font-semibold tracking-tight transition-opacity hover:opacity-80"
                    >
                        <span>InferLoop</span>
                        <span className="text-muted-foreground transition-colors group-hover:text-foreground">.ai</span>
                    </Link>
                </div>

                <nav className="flex items-center gap-1.5">
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
                            <ThemeToggle />
                        </>
                    )}

                    {auth.status === 'authenticated' && (
                        <>
                            <ThemeToggle />
                            <UserMenu />
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
