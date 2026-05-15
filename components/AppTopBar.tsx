'use client';

// Thin top bar that lives inside the (app) shell, to the right of the
// sidebar. Carries the InferLoop wordmark on the left and the mobile-only
// hamburger that opens the sidebar drawer. The sidebar still owns nav,
// theme, and user controls — this bar is brand + mobile entry-point only.

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

export function AppTopBar() {
    const { toggle } = useSidebar();

    return (
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md">
            <button
                type="button"
                onClick={toggle}
                aria-label="Open sidebar"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
            >
                <Menu className="h-4 w-4" />
            </button>

            <Link
                href="/review"
                className="group flex items-baseline gap-0 font-mono text-base font-semibold tracking-tight transition-opacity hover:opacity-80"
            >
                <span>InferLoop</span>
                <span className="text-muted-foreground transition-colors group-hover:text-foreground">.ai</span>
            </Link>
        </div>
    );
}
