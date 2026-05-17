'use client';

// Tiny context that lets the top bar's hamburger and the AppSidebar drawer
// stay in sync on mobile, and also tracks the desktop expand/collapse state.
//
// `open` = mobile drawer visibility (only matters below the lg breakpoint).
// `collapsed` = desktop rail vs full-width (only matters at lg+). Persists
//   to localStorage so the choice survives reloads.
//
// Also carries a monotonically-increasing `recentsVersion` counter — the
// review page bumps it after a stream completes so the AppSidebar refetches
// its Recents list without us hand-rolling a pub/sub.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type SidebarContextValue = {
    open: boolean;
    setOpen: (next: boolean) => void;
    toggle: () => void;
    collapsed: boolean;
    setCollapsed: (next: boolean) => void;
    toggleCollapsed: () => void;
    inApp: boolean;
    recentsVersion: number;
    refreshRecents: () => void;
    /** Bumped when the user clicks "New review" while already on /review.
     *  The review page listens to this so it can wipe its in-memory state
     *  (code, iterations, loop result) without a full page reload. */
    newReviewVersion: number;
    requestNewReview: () => void;
};

const COLLAPSE_KEY = 'inferloop.sidebar.collapsed';

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [recentsVersion, setRecentsVersion] = useState(0);
    const [newReviewVersion, setNewReviewVersion] = useState(0);

    // Hydrate collapsed state from localStorage after mount, so SSR markup
    // matches the initial client render (always expanded), then we flip.
    useEffect(() => {
        try {
            const stored = localStorage.getItem(COLLAPSE_KEY);
            if (stored === '1') setCollapsed(true);
        } catch { /* localStorage unavailable */ }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
        } catch { /* swallow */ }
    }, [collapsed]);

    const toggle = useCallback(() => setOpen((o) => !o), []);
    const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);
    const refreshRecents = useCallback(() => setRecentsVersion((v) => v + 1), []);
    const requestNewReview = useCallback(() => setNewReviewVersion((v) => v + 1), []);

    return (
        <SidebarContext.Provider
            value={{
                open,
                setOpen,
                toggle,
                collapsed,
                setCollapsed,
                toggleCollapsed,
                inApp: true,
                recentsVersion,
                refreshRecents,
                newReviewVersion,
                requestNewReview,
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

// Safe to call outside the provider — returns a no-op fallback so consumers
// rendered above the provider (or on routes without a sidebar) don't crash.
export function useSidebar(): SidebarContextValue {
    const ctx = useContext(SidebarContext);
    return (
        ctx ?? {
            open: false,
            setOpen: () => {},
            toggle: () => {},
            collapsed: false,
            setCollapsed: () => {},
            toggleCollapsed: () => {},
            inApp: false,
            recentsVersion: 0,
            refreshRecents: () => {},
            newReviewVersion: 0,
            requestNewReview: () => {},
        }
    );
}
