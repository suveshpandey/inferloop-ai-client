// Authenticated app shell. ChatGPT / Gemini-style layout: a full-height
// sidebar on the left, and a main column on the right that owns its own
// thin top bar carrying only the brand name (plus a mobile hamburger).

import { AppSidebar } from '@/components/AppSidebar';
import { AppTopBar } from '@/components/AppTopBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-dvh">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <AppTopBar />
                <div className="flex-1">{children}</div>
            </div>
        </div>
    );
}
