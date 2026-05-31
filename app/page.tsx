'use client';

import { Fragment, useEffect } from 'react';
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
                    <span className="text-muted-foreground transition-colors group-hover:text-foreground">.ai</span>
                </Link>
                <nav className="flex items-center gap-1.5">
                    <Link
                        href="/how-it-works"
                        className={`${buttonVariants({ variant: 'ghost' })} font-mono text-[15px] h-9 px-3.5`}
                    >
                        How it works
                    </Link>
                    <Link
                        href="/login"
                        className={`${buttonVariants({ variant: 'ghost' })} font-mono text-[15px] h-9 px-3.5`}
                    >
                        Log in
                    </Link>
                    <Link
                        href="/signup"
                        className={`${buttonVariants()} font-mono text-[15px] h-9 px-3.5`}
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
                            Test-driven multi-agent review · streaming
                        </span>
                    </Badge>

                    {/* Headline */}
                    <h1
                        className="animate-fade-up mt-8 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
                        style={{ animationDelay: '80ms' }}
                    >
                        Five agents.
                        <br />
                        <span className="text-muted-foreground">One </span>
                        <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                            tested
                        </span>
                        <span className="text-muted-foreground"> review.</span>
                    </h1>

                    <p
                        className="animate-fade-up mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
                        style={{ animationDelay: '160ms' }}
                    >
                        InferLoop runs your DSA / competitive-programming solution through five agents — and
                        through test cases it actually executes in a Vercel sandbox. Measured pass-rate
                        drives the loop, so the verdict is grounded in code that ran, not just an LLM
                        opinion. Watch every stage stream back live.
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
                        The pipeline
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
                        What each agent does
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                        Five steps · one continuous flow
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
                    Sandboxed code execution · streaming SSE · provider-swappable LLM (Ollama · Gemini · Euri).
                </p>
            </section>

            <Footer />
        </div>
    );
}
