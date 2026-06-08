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
import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Plus, X, UserRound, Trash2, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { initialsFromIdentity } from '@/lib/user';
import { getLanguage } from '@/lib/languages';
import { api } from '@/lib/api';
import { notifyError } from '@/lib/notify';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import type { RunSummary } from '@/lib/types';

export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const auth = useAuth();
    const { open, setOpen, recentsVersion, collapsed, toggleCollapsed, requestNewReview } = useSidebar();
    const [recents, setRecents] = useState<RunSummary[] | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    // The run awaiting confirmation. Null = no modal open.
    const [pendingDelete, setPendingDelete] = useState<RunSummary | null>(null);
    // True while the confirmed delete request is in flight.
    const [deleting, setDeleting] = useState(false);

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        const { id } = pendingDelete;
        setDeleting(true);
        try {
            await api.deleteRun(id);
            // Optimistically drop from local state — no need to refetch.
            setRecents((prev) => prev?.filter((r) => r.id !== id) ?? prev);
            // If we were on the deleted run's detail page, send the user back
            // to /review so they don't sit on a now-404 route.
            if (pathname === `/history/${id}`) router.replace('/review');
            setPendingDelete(null);
        } catch (err) {
            notifyError(err, { description: 'Could not delete this review. Try again.' });
        } finally {
            setDeleting(false);
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

    const filteredRecents = useMemo(() => {
        if (!recents) return null;
        const q = searchQuery.trim().toLowerCase();
        if (!q) return recents;
        return recents.filter((r) => r.title.toLowerCase().includes(q));
    }, [recents, searchQuery]);

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
                    collapsed ? 'lg:w-14' : 'lg:w-72',
                    'w-72',  // mobile drawer always full width
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
                    {recents && recents.length > 0 && (
                        <div className="relative mb-2">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                            <Input
                                type="text"
                                role="searchbox"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search reviews…"
                                aria-label="Search reviews by name"
                                className={[
                                    'h-8 bg-background/50 pl-8 text-[13px] placeholder:text-muted-foreground/50',
                                    searchQuery ? 'pr-8' : 'pr-2.5',
                                ].join(' ')}
                            />
                            {searchQuery.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    aria-label="Clear search"
                                    className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent/50 hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                    {filteredRecents && filteredRecents.length > 0 ? (
                        <ul className="themed-scrollbar -mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1">
                            {filteredRecents.map((r) => (
                                <li key={r.id}>
                                    <RecentRow
                                        href={`/history/${r.id}`}
                                        label={stripLanguagePrefix(r.title, r.language)}
                                        language={r.language}
                                        active={pathname === `/history/${r.id}`}
                                        deleting={deleting && pendingDelete?.id === r.id}
                                        onDelete={() => setPendingDelete(r)}
                                    />
                                </li>
                            ))}
                        </ul>
                    ) : recents && recents.length > 0 && searchQuery.trim() ? (
                        <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-center">
                            <p className="text-[11px] text-muted-foreground">No matching reviews</p>
                        </div>
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

            <ConfirmDialog
                open={pendingDelete !== null}
                title="Delete review"
                description={
                    <>
                        <p>
                            Permanently delete{' '}
                            <span className="font-medium">“{pendingDelete?.title}”</span>?
                        </p>
                        <p className="mt-1.5 text-[12px] text-muted-foreground">
                            This removes the run and its iterations from your history. This action cannot be undone.
                        </p>
                    </>
                }
                confirmLabel="Delete"
                loadingLabel="Deleting…"
                confirmVariant="destructive"
                loading={deleting}
                onCancel={() => { if (!deleting) setPendingDelete(null); }}
                onConfirm={confirmDelete}
            />
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
    language,
    active,
    deleting,
    onDelete,
}: {
    href: string;
    label: string;
    language: string;
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
                    'flex items-center gap-2 rounded-md px-2 py-1.5 pr-7 text-[13px] transition-colors',
                    active
                        ? 'bg-accent/60 text-foreground'
                        : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
                ].join(' ')}
            >
                <LanguagePill language={language} />
                <span className="min-w-0 truncate">{label}</span>
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

const LANGUAGE_PILL_STYLES: Record<string, string> = {
    python: [
        'border-blue-600/25 bg-blue-600/[0.07] text-blue-800/90',
        'dark:border-blue-400/12 dark:bg-blue-400/[0.05] dark:text-blue-400/50',
    ].join(' '),
    cpp: [
        'border-orange-600/25 bg-orange-600/[0.07] text-orange-800/90',
        'dark:border-orange-400/12 dark:bg-orange-400/[0.05] dark:text-orange-400/50',
    ].join(' '),
};

function languagePillLabel(language: string): string {
    const meta = getLanguage(language);
    if (meta?.value === 'cpp') return 'C++';
    if (meta?.value === 'python') return 'Py';
    return language.slice(0, 3).toUpperCase();
}

function LanguagePill({ language }: { language: string }) {
    const style =
        LANGUAGE_PILL_STYLES[language.toLowerCase()] ??
        'border-border/60 bg-background/60 text-muted-foreground';
    return (
        <span
            className={[
                'shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide',
                style,
            ].join(' ')}
        >
            {languagePillLabel(language)}
        </span>
    );
}

/** Titles are stored as "python · Two Sum" — drop the redundant prefix in the row. */
function stripLanguagePrefix(title: string, language: string): string {
    const prefix = `${language} · `;
    if (title.startsWith(prefix)) return title.slice(prefix.length);
    const alt = `${language.toLowerCase()} · `;
    if (title.toLowerCase().startsWith(alt)) {
        return title.slice(alt.length);
    }
    return title;
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
