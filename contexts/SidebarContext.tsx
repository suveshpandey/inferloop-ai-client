'use client';

// Tiny context that lets the Header's hamburger and the AppSidebar drawer
// stay in sync on mobile. On lg+ the sidebar is permanently visible, so this
// only matters below the lg breakpoint.
//
// Also carries a monotonically-increasing `recentsVersion` counter — the
// review page bumps it after a stream completes so the AppSidebar refetches
// its Recents list without us hand-rolling a pub/sub.

import { createContext, useCallback, useContext, useState } from 'react';

type SidebarContextValue = {
    open: boolean;
    setOpen: (next: boolean) => void;
    toggle: () => void;
    inApp: boolean;
    recentsVersion: number;
    refreshRecents: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [recentsVersion, setRecentsVersion] = useState(0);
    const toggle = useCallback(() => setOpen((o) => !o), []);
    const refreshRecents = useCallback(() => setRecentsVersion((v) => v + 1), []);
    return (
        <SidebarContext.Provider
            value={{ open, setOpen, toggle, inApp: true, recentsVersion, refreshRecents }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

// Safe to call outside the provider — returns a no-op fallback so the Header
// (in the root layout, which also renders on routes without a sidebar) can
// call `useSidebar()` without crashing.
export function useSidebar(): SidebarContextValue {
    const ctx = useContext(SidebarContext);
    return (
        ctx ?? {
            open: false,
            setOpen: () => {},
            toggle: () => {},
            inApp: false,
            recentsVersion: 0,
            refreshRecents: () => {},
        }
    );
}
