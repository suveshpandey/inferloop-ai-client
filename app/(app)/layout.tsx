// Authenticated app shell. The root <Header> stays as-is — it owns brand,
// theme, and the profile dropdown. This shell only adds a thin left rail for
// in-app navigation (review · history · profile).
//
// The rail uses lg:sticky and computes its height from 100dvh - header-height,
// so it scrolls independently and never overlaps the header.

import { AppSidebar } from '@/components/AppSidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex">
            <AppSidebar />
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}
