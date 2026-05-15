'use client';

// Bottom strip of the sidebar: avatar + display name. Clicking opens an
// upward-anchored popover containing the theme toggle, profile link, and
// log out — same set the old header dropdown carried, just relocated.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Sun, Moon, UserRound, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { initialsFromIdentity } from '@/lib/user';

export function SidebarUserStrip() {
    const auth = useAuth();
    const router = useRouter();
    const { theme, toggle: toggleTheme } = useTheme();

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

    const ThemeIcon = theme === 'dark' ? Sun : Moon;
    const themeLabel = theme === 'dark' ? 'Light mode' : 'Dark mode';

    return (
        <div ref={wrapperRef} className="relative border-t border-sidebar-border px-2 py-2">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/60"
            >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sidebar-border bg-card font-mono text-[11px] font-semibold uppercase tracking-wider">
                    {initials}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{displayName}</span>
            </button>

            {open && (
                <div
                    role="menu"
                    className="animate-fade-up absolute bottom-[calc(100%+0.25rem)] left-2 right-2 origin-bottom overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl"
                >
                    {/* Header — email (read-only) */}
                    <div className="border-b border-border px-3 py-2.5">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            Signed in as
                        </p>
                        <p className="mt-0.5 truncate text-sm">{email}</p>
                    </div>

                    {/* Items */}
                    <div className="p-1">
                        <MenuButton onClick={() => { toggleTheme(); }}>
                            <ThemeIcon className="h-4 w-4 text-muted-foreground" />
                            {themeLabel}
                        </MenuButton>

                        <Link
                            href="/profile"
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            Profile
                        </Link>

                        <MenuButton onClick={handleLogout}>
                            <LogOut className="h-4 w-4 text-muted-foreground" />
                            Log out
                        </MenuButton>
                    </div>
                </div>
            )}
        </div>
    );
}

function MenuButton({
    onClick,
    children,
}: {
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
            {children}
        </button>
    );
}
