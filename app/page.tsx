'use client';

import { Fragment, useEffect } from 'react';
import { Star } from 'lucide-react';

function GithubMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.33.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.71 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.44-2.69 5.42-5.25 5.7.41.36.78 1.05.78 2.13v3.16c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
        </svg>
    );
}
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { HeroVisual } from '@/components/HeroVisual';
import { Meteors } from '@/components/Meteors';
import { LoadingState } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Footer } from '@/components/Footer';

// Five agents in the order they appear in the review timeline, sequentially
// numbered 01–05 to read as one continuous flow on the landing page.
const AGENTS = [
    { name: 'Test generator', kind: 'pre-loop',  desc: 'Drafts ~6 test cases probing samples, edges, and overflow — once, before the loop starts.',           glyph: '01' },
    { name: 'Analyzer',       kind: 'in-loop',   desc: 'Surfaces correctness, complexity, and edge-case risks against the problem\'s stated constraints.',     glyph: '02' },
    { name: 'Critic',         kind: 'in-loop',   desc: 'Audits each finding — keep, drop, or refine with a reason — so the rewrite chases only real issues.',  glyph: '03' },
    { name: 'Improver',       kind: 'in-loop',   desc: 'Rewrites the code against the verified findings and the cases the previous attempt actually failed.',  glyph: '04' },
    { name: 'Evaluator',      kind: 'post-loop', desc: 'Reads the measured sandbox pass-rate and writes the final verdict — improved, unchanged, or regressed.', glyph: '05' },
];

export default function Home() {
    const auth = useAuth();
    const router = useRouter();

    // Authenticated users skip the landing page entirely — same flow as /login
    // and /signup. Keeps the marketing surface for visitors only.
    useEffect(() => {
        if (auth.status === 'authenticated') router.replace('/review');
    }, [auth.status, router]);

    if (auth.status === 'loading' || auth.status === 'authenticated') {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <LoadingState label="Loading" />
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden">
            {/* Meteors — diagonal streaks travelling top-left → bottom-right */}
            {/* <Meteors /> */}

            {/* Inline page header — brand + auth CTAs. Lives inside the page
                (not a global layout header) so it scrolls with the hero. */}
            <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
                <Link
                    href="/"
                    className="group flex items-baseline gap-0 font-mono text-base font-semibold tracking-tight transition-opacity hover:opacity-80"
                >
                    <span>InferLoop</span>
                    <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">.ai</span>
                </Link>
                <nav className="flex items-center gap-1 sm:gap-1.5">
                    <Link
                        href="/how-it-works"
                        className={`${buttonVariants({ variant: 'ghost' })} hidden font-mono text-[15px] h-9 px-3.5 sm:inline-flex`}
                    >
                        How it works
                    </Link>
                    <Link
                        href="/login"
                        className={`${buttonVariants({ variant: 'ghost' })} font-mono text-[13px] h-9 px-2.5 sm:text-[15px] sm:px-3.5`}
                    >
                        Log in
                    </Link>
                    <Link
                        href="/signup"
                        className={`${buttonVariants()} font-mono text-[13px] h-9 px-2.5 sm:text-[15px] sm:px-3.5`}
                    >
                        Sign up
                    </Link>
                    <ThemeToggle />
                </nav>
            </header>

            {/* HERO — two-column on lg+ */}
            <section className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pt-16 pb-16 sm:pt-24 sm:pb-24 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
                <div>
                    {/* Tag pill */}
                    <Badge
                        variant="outline"
                        className="animate-fade-up h-auto gap-2 rounded-full bg-card/50 px-3 py-1 text-xs font-normal"
                        style={{ animationDelay: '0ms' }}
                    >
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/60 opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground" />
                        </span>
                        <span className="font-mono uppercase tracking-widest text-muted-foreground">
                            <span className="text-foreground">AI</span> · test-driven multi-agent review + rewrite · streaming
                        </span>
                    </Badge>

                    {/* Headline — same three verbs as before, but each is
                        tinted so the AI signal lands at first glance, with
                        a small "by five AI agents" tag underneath. */}
                    <h1
                        className="animate-fade-up mt-8 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
                        style={{ animationDelay: '80ms' }}
                    >
                        <span className="text-foreground">Reviewed. </span>
                        <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                            Tested.
                        </span>
                        <span className="text-muted-foreground"> Rewritten.</span>
                    </h1>
                    <p
                        className="animate-fade-up mt-3 font-mono text-sm uppercase tracking-widest text-muted-foreground sm:text-base"
                        style={{ animationDelay: '120ms' }}
                    >
                        by <span className="font-semibold text-foreground">five</span>{' '}
                        <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text font-semibold text-transparent">
                            AI agents
                        </span>
                        , in one streaming loop.
                    </p>

                    <p
                        className="animate-fade-up mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
                        style={{ animationDelay: '160ms' }}
                    >
                        InferLoop runs your DSA / competitive-programming solution through a pipeline of
                        five LLM-powered agents that review it, rewrite it, and re-test the rewrite against
                        cases executed in a Vercel sandbox. Measured pass-rate drives the loop — the rewrite
                        you get back is the one that actually scored highest. Watch every stage stream live.
                    </p>

                    {/* CTAs */}
                    <div
                        className="animate-fade-up mt-10 flex flex-col gap-3 sm:flex-row"
                        style={{ animationDelay: '240ms' }}
                    >
                        <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
                            Get started →
                        </Link>
                        <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                            Log in
                        </Link>
                    </div>

                    {/* Open-source row — two small star pills sit right under the
                        primary CTAs so the call-to-action remains the main thing
                        while the project's openness is unmissable on first scan. */}
                    <div
                        className="animate-fade-up mt-5 flex flex-wrap items-center gap-x-3 gap-y-2"
                        style={{ animationDelay: '320ms' }}
                    >
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            Open source · star on GitHub
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                            <a
                                href="https://github.com/suveshpandey/inferloop-ai-server"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 font-mono text-[11px] text-foreground/85 transition-colors hover:border-foreground/30 hover:bg-card hover:text-foreground"
                            >
                                <GithubMark className="h-3 w-3" />
                                <span>inferloop-ai-server</span>
                                <Star className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-foreground" />
                            </a>
                            <a
                                href="https://github.com/suveshpandey/inferloop-ai-client"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 font-mono text-[11px] text-foreground/85 transition-colors hover:border-foreground/30 hover:bg-card hover:text-foreground"
                            >
                                <GithubMark className="h-3 w-3" />
                                <span>inferloop-ai-client</span>
                                <Star className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-foreground" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Right column: animated review console */}
                <div
                    className="animate-fade-up"
                    style={{ animationDelay: '320ms' }}
                >
                    <HeroVisual />
                </div>
            </section>

            {/* Pipeline flow visualization */}
            <section className="relative mx-auto max-w-6xl px-6 pb-16">
                <div
                    className="animate-fade-up"
                    style={{ animationDelay: '440ms' }}
                >
                    <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        The <span className="text-foreground">AI</span> pipeline
                    </p>
                    <div className="relative overflow-hidden rounded-xl border border-border bg-card/40 p-6">
                        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs">
                            {AGENTS.map((a, i) => (
                                <Fragment key={a.name}>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground">
                                            {a.glyph}
                                        </div>
                                        <span className="hidden truncate sm:inline">{a.name}</span>
                                    </div>
                                    {i < AGENTS.length - 1 && (
                                        <div className="relative h-px flex-1 overflow-hidden">
                                            <div className="h-px w-full bg-border" />
                                            <div
                                                className="animate-flow absolute top-1/2 h-px w-12 -translate-y-1/2 bg-gradient-to-r from-transparent via-foreground to-transparent"
                                                style={{ animationDelay: `${i * 0.4}s` }}
                                            />
                                        </div>
                                    )}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Agent cards */}
            <section className="relative mx-auto max-w-6xl px-6 pb-20">
                <div className="mb-6 flex items-baseline justify-between gap-4">
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        Review → rewrite → re-test
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                        Five steps · one continuous loop
                    </p>
                </div>

                <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {AGENTS.map((a, i) => (
                        <Card
                            key={a.name}
                            className="animate-fade-up flex h-full flex-col gap-0 bg-card/50 p-5 transition-colors duration-200 hover:bg-card"
                            style={{ animationDelay: `${520 + i * 80}ms` }}
                        >
                            {/* Numbered glyph — featured at the top of the card. */}
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background font-mono text-sm font-semibold text-foreground">
                                {a.glyph}
                            </div>

                            {/* Lifecycle pill — pre / in / post-loop. */}
                            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                {a.kind}
                            </p>

                            <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                                {a.name}
                            </p>
                            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                                {a.desc}
                            </p>
                        </Card>
                    ))}
                </div>

                <p
                    className="animate-fade-up mt-16 font-mono text-xs text-muted-foreground"
                    style={{ animationDelay: '920ms' }}
                >
                    Sandboxed code execution · iterative rewrite loop · streaming SSE · provider-swappable LLM (Ollama · Gemini · Euri).
                </p>
            </section>

            <Footer />
        </div>
    );
}
