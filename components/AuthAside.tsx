import Link from 'next/link';
import { Box, Sparkles } from 'lucide-react';

type AuthMode = 'login' | 'signup';

const COPY: Record<AuthMode, { caption: string; tagline: string }> = {
    login: {
        caption: 'Authenticated access',
        tagline: 'Sign in to run live, multi-agent reviews on your code.',
    },
    signup: {
        caption: 'New account',
        tagline: 'Create an account to start running live, multi-agent code reviews.',
    },
};

export function AuthAside({ mode = 'login' }: { mode?: AuthMode }) {
    const { caption, tagline } = COPY[mode];

    return (
        <aside className="relative hidden flex-col items-center justify-center overflow-hidden border-r border-border/60 bg-card/30 px-12 lg:flex">
            <div className="animate-fade-up flex flex-col items-center gap-5 text-center">
                {/* Brand — clickable to land on the marketing page. */}
                <Link href="/" className="group transition-opacity hover:opacity-80" aria-label="InferLoop home">
                    <h2 className="font-mono text-5xl font-semibold tracking-tight">
                        <span>InferLoop</span>
                        <span className="text-muted-foreground transition-colors group-hover:text-foreground">.ai</span>
                    </h2>
                </Link>

                {/* Accent line */}
                <div className="h-px w-10 bg-border" />

                {/* Formal sub-line — varies by mode */}
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    {caption}
                </p>

                {/* Tagline — varies by mode */}
                <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {tagline}
                </p>

                {/* Icon row — shared (these are product traits, not page state) */}
                <div className="mt-2 flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <Box className="h-3 w-3" />
                        Sandboxed
                    </span>
                    <span className="h-3 w-px bg-border" />
                    <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" />
                        Multi-agent
                    </span>
                </div>
            </div>
        </aside>
    );
}
