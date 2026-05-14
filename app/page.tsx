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

const AGENTS = [
    { name: 'Analyzer',  desc: 'Surfaces bugs, smells, security and perf risk in your source.', glyph: '01' },
    { name: 'Critic',    desc: 'Audits each finding — keep, drop, or refine with a reason.',     glyph: '02' },
    { name: 'Improver',  desc: 'Rewrites the code against the verified, surviving issues.',      glyph: '03' },
    { name: 'Evaluator', desc: 'Scores the rewrite — improved, unchanged, or regressed.',        glyph: '04' },
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
            <Meteors />

            {/* HERO — two-column on lg+ */}
            <section className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pt-24 pb-16 sm:pt-32 sm:pb-24 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
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
                            Multi-agent review · streaming
                        </span>
                    </Badge>

                    {/* Headline */}
                    <h1
                        className="animate-fade-up mt-8 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
                        style={{ animationDelay: '80ms' }}
                    >
                        Four agents.
                        <br />
                        <span className="text-muted-foreground">One </span>
                        <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                            honest
                        </span>
                        <span className="text-muted-foreground"> review.</span>
                    </h1>

                    <p
                        className="animate-fade-up mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
                        style={{ animationDelay: '160ms' }}
                    >
                        InferLoop runs your code through an Analyzer, a Critic, an Improver, and an
                        Evaluator — each one auditing the last. Results stream back as they happen,
                        so you watch the review unfold instead of waiting for a black box.
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
                <p className="mb-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    What each agent does
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {AGENTS.map((a, i) => (
                        <Card
                            key={a.name}
                            className="animate-fade-up group relative gap-0 bg-card/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-card hover:ring-foreground/30"
                            style={{ animationDelay: `${520 + i * 80}ms` }}
                        >
                            <div className="flex items-baseline justify-between">
                                <p className="font-mono text-sm font-semibold">{a.name}</p>
                                <span className="font-mono text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                                    {a.glyph}
                                </span>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                {a.desc}
                            </p>
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        </Card>
                    ))}
                </div>

                <p
                    className="animate-fade-up mt-16 font-mono text-xs text-muted-foreground"
                    style={{ animationDelay: '880ms' }}
                >
                    Local-first · powered by Ollama · 100% your code, your machine.
                </p>
            </section>
        </div>
    );
}
