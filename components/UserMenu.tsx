'use client';

// Profile avatar → anchored dropdown showing the user's identity card and a
// menu of account actions (Profile, Log out). Built from primitives to keep
// the dependency footprint small — closes on outside-click + Escape.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { initialsFromIdentity } from '@/lib/user';

export function UserMenu() {
    const auth = useAuth();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: PointerEvent) => {
            if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (auth.status !== 'authenticated') return null;

    const { email, username } = auth.user;
    const displayName = username?.trim() || email.split('@')[0];
    const initials = initialsFromIdentity(username, email);

    const handleLogout = async () => {
        setOpen(false);
        await auth.logout();
        router.replace('/login');
    };

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label="Open user menu"
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card font-mono text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {initials}
            </button>

            {open && (
                <div
                    role="menu"
                    className="animate-fade-up absolute right-0 mt-2 w-72 origin-top-right overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
                >
                    <div className="flex items-center gap-3 border-b border-border bg-card/40 px-4 py-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-sm font-semibold uppercase tracking-wider">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-tight">{displayName}</p>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                {email}
                            </p>
                        </div>
                    </div>

                    <div className="p-1.5">
                        <Link
                            href="/profile"
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="group flex items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            <span className="flex items-center gap-2.5">
                                <UserRound className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground" />
                                Profile
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:text-accent-foreground" />
                        </Link>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleLogout}
                            className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            <LogOut className="h-4 w-4 text-muted-foreground group-hover:text-accent-foreground" />
                            Log out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
