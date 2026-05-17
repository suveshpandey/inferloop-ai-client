'use client';

// Quiet navigation rail for the (app) shell. Matches the rest of the app's
// voice: thin borders, mono uppercase section labels, small text rows.
//
// Structure (top → bottom):
//   • "New review" primary nav row
//   • Recent reviews list (history — scrollable, fills available space)
//   • Profile strip at the bottom — bordered, shows the user's email,
//     entire row is a link to /profile.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { Plus, X, UserRound, Trash2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { initialsFromIdentity } from '@/lib/user';
import { api } from '@/lib/api';
import { notifyError } from '@/lib/notify';
import type { RunSummary } from '@/lib/types';

export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const auth = useAuth();
    const { open, setOpen, recentsVersion, collapsed, toggleCollapsed, requestNewReview } = useSidebar();
    const [recents, setRecents] = useState<RunSummary[] | null>(null);
    // Track per-row delete state so the row dims while its request is in
    // flight. A simple set keeps it cheap — we only ever delete a handful.
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    const handleDelete = async (id: string) => {
        setDeletingIds((prev) => new Set(prev).add(id));
        try {
            await api.deleteRun(id);
            // Optimistically drop from local state — no need to refetch.
            setRecents((prev) => prev?.filter((r) => r.id !== id) ?? prev);
            // If we were on the deleted run's detail page, send the user back
            // to /review so they don't sit on a now-404 route.
            if (pathname === `/history/${id}`) router.replace('/review');
        } catch (err) {
            notifyError(err, { description: 'Could not delete this review. Try again.' });
        } finally {
            setDeletingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    // Fetch on mount, on login transition, on `recentsVersion` bumps from
    // the review page (after a stream completes), and on pathname changes
    // (so navigating back from /history/[id] picks up any edits). We don't
    // show a spinner — the empty state is fine while loading; the list pops
    // in when the fetch resolves.
    useEffect(() => {
        if (auth.status !== 'authenticated') {
            setRecents(null);
            return;
        }
        let cancelled = false;
        api.listRuns()
            .then((r) => { if (!cancelled) setRecents(r.runs); })
            .catch(() => { if (!cancelled) setRecents([]); });
        return () => { cancelled = true; };
    }, [auth.status, recentsVersion, pathname]);

    // Refetch when the tab regains focus. Cheap network ping, big UX win —
    // a run that completed while the tab was backgrounded shows up the
    // moment the user looks at the window again. Standard chat-app pattern.
    useEffect(() => {
        if (auth.status !== 'authenticated') return;
        const onFocus = () => {
            api.listRuns()
                .then((r) => setRecents(r.runs))
                .catch(() => { /* swallow — keep showing whatever we had */ });
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [auth.status]);

    useEffect(() => {
        setOpen(false);
    }, [pathname, setOpen]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    return (
        <>
            {/* Mobile backdrop */}
            {open && (
                <div
                    onClick={() => setOpen(false)}
                    aria-hidden
                    className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
                />
            )}

            <aside
                className={[
                    'flex h-dvh shrink-0 flex-col border-r border-border bg-background',
                    'transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]',
                    collapsed ? 'lg:w-14' : 'lg:w-60',
                    'w-60',  // mobile drawer always full width
                    'lg:sticky lg:top-0',
                    'fixed left-0 top-0 z-50 lg:translate-x-0',
                    open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
                ].join(' ')}
                aria-label="Primary navigation"
            >
                {/* Top row — matches the top bar height (h-14) and holds the
                    desktop expand/collapse toggle. On mobile this row holds
                    the close button instead (no collapse on small screens). */}
                <div className="flex h-14 items-center justify-between px-3">
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:flex"
                    >
                        {collapsed ? (
                            <PanelLeftOpen className="h-4 w-4" />
                        ) : (
                            <PanelLeftClose className="h-4 w-4" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Close navigation"
                        className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* New review — if we're already on /review, intercept the
                    click and bump newReviewVersion instead of doing a no-op
                    navigation. The page listens to that signal and resets
                    its in-memory state for a clean editor. */}
                <div className="px-3 pt-2 pb-3">
                    <NavRow
                        href="/review"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        label="New review"
                        active={pathname === '/review'}
                        collapsed={collapsed}
                        onClick={(e) => {
                            if (pathname === '/review') {
                                e.preventDefault();
                                requestNewReview();
                            }
                        }}
                    />
                </div>

                {/* Divider — separates the primary action from the history
                    list. Dim enough that it doesn't compete with the sidebar's
                    own right border. */}
                <div className="mx-3 border-t border-border/50" />

                {/* Recents — fades out when the desktop rail collapses. */}
                <div
                    className={[
                        'flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-3 pb-3',
                        'transition-opacity duration-200',
                        collapsed
                            ? 'lg:pointer-events-none lg:opacity-0'
                            : 'opacity-100',
                    ].join(' ')}
                >
                    <p className="mb-2 px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Recents
                    </p>
                    {recents && recents.length > 0 ? (
                        <ul className="themed-scrollbar -mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1">
                            {recents.map((r) => (
                                <li key={r.id}>
                                    <RecentRow
                                        href={`/history/${r.id}`}
                                        label={r.title}
                                        active={pathname === `/history/${r.id}`}
                                        deleting={deletingIds.has(r.id)}
                                        onDelete={() => handleDelete(r.id)}
                                    />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <RecentEmptyState />
                    )}
                </div>

                {/* Profile strip */}
                {auth.status === 'authenticated' && (
                    <ProfileStrip
                        email={auth.user.email}
                        username={auth.user.username}
                        active={pathname === '/profile'}
                        collapsed={collapsed}
                    />
                )}
            </aside>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

function NavRow({
    href,
    icon,
    label,
    active,
    collapsed,
    onClick,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    active: boolean;
    collapsed: boolean;
    onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
    return (
        <Link
            href={href}
            title={collapsed ? label : undefined}
            aria-label={label}
            onClick={onClick}
            className={[
                'flex items-center gap-2 rounded-md py-1.5 text-sm transition-colors',
                collapsed ? 'lg:justify-center lg:px-0 px-2' : 'px-2',
                active
                    ? 'bg-accent/60 text-foreground'
                    : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
            ].join(' ')}
        >
            <span className={active ? 'text-foreground' : 'text-muted-foreground'}>{icon}</span>
            <span
                className={[
                    'truncate transition-opacity duration-200',
                    collapsed ? 'lg:pointer-events-none lg:hidden lg:opacity-0' : 'opacity-100',
                ].join(' ')}
            >
                {label}
            </span>
        </Link>
    );
}

function RecentRow({
    href,
    label,
    active,
    deleting,
    onDelete,
}: {
    href: string;
    label: string;
    active: boolean;
    deleting: boolean;
    onDelete: () => void;
}) {
    // The delete button overlaps the trailing edge of the link and only fades
    // in on hover/focus-within. We stop event propagation so the parent Link
    // doesn't fire a navigation when the trash icon is clicked.
    const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (deleting) return;
        onDelete();
    };

    return (
        <div className={['group relative', deleting && 'opacity-50'].filter(Boolean).join(' ')}>
            <Link
                href={href}
                aria-disabled={deleting}
                className={[
                    'flex items-center rounded-md px-2 py-1.5 pr-7 text-[13px] transition-colors',
                    active
                        ? 'bg-accent/60 text-foreground'
                        : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
                ].join(' ')}
            >
                <span className="truncate">{label}</span>
            </Link>
            <button
                type="button"
                onClick={handleDeleteClick}
                aria-label={`Delete ${label}`}
                disabled={deleting}
                className={[
                    'absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-all',
                    'opacity-0 group-hover:opacity-100 focus:opacity-100',
                    'hover:bg-destructive/10 hover:text-destructive',
                ].join(' ')}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

function RecentEmptyState() {
    return (
        <div className="rounded-md border border-dashed border-border/70 px-3 py-5 text-center">
            <p className="text-[11px] text-muted-foreground">No reviews yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground/60">
                Your past runs will appear here.
            </p>
        </div>
    );
}

function ProfileStrip({
    email,
    username,
    active,
    collapsed,
}: {
    email: string;
    username: string | null;
    active: boolean;
    collapsed: boolean;
}) {
    const displayName = username?.trim() || email.split('@')[0];
    const initials = initialsFromIdentity(username, email);
    return (
        <Link
            href="/profile"
            aria-label="Profile"
            title={collapsed ? displayName : undefined}
            className={[
                'flex items-center gap-2.5 border-t border-border py-3 transition-colors',
                collapsed ? 'lg:justify-center lg:px-0 px-3' : 'px-3',
                active ? 'bg-accent/40' : 'hover:bg-accent/30',
            ].join(' ')}
        >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono text-[11px] font-semibold uppercase tracking-wider">
                {initials}
            </span>
            <div
                className={[
                    'min-w-0 flex-1 transition-opacity duration-200',
                    collapsed ? 'lg:pointer-events-none lg:hidden lg:opacity-0' : 'opacity-100',
                ].join(' ')}
            >
                <p className="truncate text-sm font-medium leading-tight">{displayName}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{email}</p>
            </div>
            <UserRound
                className={[
                    'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity duration-200',
                    collapsed ? 'lg:hidden lg:opacity-0' : 'opacity-100',
                ].join(' ')}
            />
        </Link>
    );
}
