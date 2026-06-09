'use client';

// Public deep-dive into the review pipeline. Linked from the landing-page
// header and footer. Accessible to logged-in and anonymous visitors alike —
// no redirect, since this is documentation. The primary CTA at the bottom
// adapts (Get started vs. Start a review) based on auth state.

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Footer } from '@/components/Footer';

const STEPS = [
    {
        n: '01',
        title: 'You submit a problem + a candidate solution',
        body: 'Paste the problem statement — constraints matter (n bounds, time limit, value ranges) — and your Python or C++ solution. Pick a max iteration cap (1–5) for how hard the loop should try.',
    },
    {
        n: '02',
        title: 'The Test generator drafts ~6 cases — once',
        body: 'Before any iteration runs, the test generator reads your problem and code and writes ~6 small cases: a mix of samples, edge cases (n=1, empty, duplicates, max element value for overflow), and boundary inputs. These are the ground truth the loop measures against.',
    },
    {
        n: '03',
        title: 'Each iteration: Analyzer → Critic → Improver → Sandbox tests',
        body: 'Inside one iteration: the Analyzer flags concrete issues (correctness, complexity, edge cases) against the problem\'s constraints; the Critic audits each finding (keep / drop / refine) so the rewrite chases only real defects; the Improver rewrites the code targeting the surviving findings plus any cases the previous iteration actually failed; the Sandbox executes the new code against every test case in one Vercel microVM and reports per-case pass/fail back live.',
    },
    {
        n: '04',
        title: 'Pass-rate drives termination',
        body: 'The loop stops the moment pass-rate hits 100% (all-pass) — your code is correct, no point iterating further. It also stops if pass-rate fails to improve (stalled) or hits your max-iteration cap. If sandbox tests aren\'t available, it falls back to stopping when the Analyzer has nothing left to flag (no-findings). Every iteration\'s pass-rate is visible live.',
    },
    {
        n: '05',
        title: 'Best-iteration code wins — then the Evaluator writes one final verdict',
        body: 'If a later iteration regressed the pass-rate, the loop surfaces the earlier, better code as final — not the regression. The Evaluator then runs once at the end, sees the final code plus the measured test results, and writes a single verdict (improved / unchanged / regressed) with scores anchored to the measured pass-rate.',
    },
    {
        n: '06',
        title: 'Everything streams live — and the run is saved to history',
        body: 'You watch each stage stream back: test generation, every agent, every per-case sandbox result, the final verdict. After the run, it\'s saved to your sidebar history with the generated test cases and final results — where you can add your own manual cases, edit existing ones (including fixing any wrong-expected the LLM emitted), and re-run on demand.',
    },
];

const PRINCIPLES = [
    {
        title: 'Tests are ground truth',
        body: 'Pass-rate is measured by actually running the code, not LLM-judged. Generated cases live alongside manual ones (clearly badged "AI" vs "You") so you can override or fix a hallucinated expected output.',
    },
    {
        title: 'Structure is sacred',
        body: 'The Improver is forbidden from removing main(), the I/O wrapper, or any function it didn\'t need to delete. Findings target inner algorithms; the program surface is preserved verbatim.',
    },
    {
        title: 'Best iteration wins',
        body: 'If iteration N regresses what iteration N-1 already had, the loop stops on "stalled" and surfaces the earlier better code as final. You never get back a worse version than you put in.',
    },
    {
        title: 'Graceful degradation',
        body: 'If the sandbox is rate-limited or transiently down, the loop continues test-free and still produces a review. An amber banner explains exactly what happened so nothing is silent.',
    },
];

const STACK = [
    { label: 'LLM',         value: 'Provider-swappable — Ollama (local), Gemini (cloud), Euri (gateway). Switch via one env flag.' },
    { label: 'Sandbox',     value: 'Vercel Sandbox microVMs. Python 3.13 native; C++ via prebuilt g++ snapshot for fast cold start.' },
    { label: 'Streaming',   value: 'Server-Sent Events from a Node/Express backend. Every stage event flows straight to the browser.' },
    { label: 'Persistence', value: 'Postgres + Prisma for run history, iterations, test cases, and per-case results.' },
];

export default function HowItWorks() {
    const auth = useAuth();
    const primaryCta = auth.status === 'authenticated'
        ? { href: '/review',  label: 'Start a review →' }
        : { href: '/signup',  label: 'Get started →'    };

    return (
        <div className="relative overflow-hidden">
            {/* Inline page header — brand + nav. Same shape as landing page so
                they read as one site. */}
            <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 pt-6">
                <Link
                    href="/"
                    className="group flex items-baseline gap-0 font-mono text-base font-semibold tracking-tight transition-opacity hover:opacity-80"
                >
                    <span>InferLoop</span>
                    <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">.ai</span>
                </Link>
                <nav className="flex items-center gap-1.5">
                    <Link
                        href="/"
                        className={`${buttonVariants({ variant: 'ghost' })} font-mono text-[15px] h-9 px-3.5`}
                    >
                        Home
                    </Link>
                    <Link
                        href={primaryCta.href}
                        className={`${buttonVariants()} font-mono text-[15px] h-9 px-3.5`}
                    >
                        {primaryCta.label}
                    </Link>
                    <ThemeToggle />
                </nav>
            </header>

            {/* Intro */}
            <section className="relative mx-auto max-w-3xl px-6 pt-16 pb-12 sm:pt-24">
                <Badge
                    variant="outline"
                    className="animate-fade-up h-auto gap-2 rounded-full bg-card/50 px-3 py-1 text-xs font-normal"
                >
                    <span className="font-mono uppercase tracking-widest text-muted-foreground">
                        How it works
                    </span>
                </Badge>
                <h1 className="animate-fade-up mt-6 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                    How InferLoop reviews your code,
                    <br />
                    <span className="text-muted-foreground">end to end.</span>
                </h1>
                <p className="animate-fade-up mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                    InferLoop is a DSA / competitive-programming code reviewer built around one rule:
                    every verdict is grounded in code that actually ran in a sandbox. Five agents,
                    a sandbox executor, a single termination signal — pass-rate. Here&apos;s the full
                    flow, from submission to final verdict.
                </p>
            </section>

            {/* The flow — numbered step cards, stacked vertically with a left rail. */}
            <section className="relative mx-auto max-w-3xl px-6 pb-16">
                <p className="mb-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    The flow
                </p>
                <ol className="relative space-y-3 border-l border-border/60 pl-6">
                    {STEPS.map((s, i) => (
                        <li
                            key={s.n}
                            className="animate-fade-up relative"
                            style={{ animationDelay: `${80 + i * 60}ms` }}
                        >
                            {/* Step glyph anchored to the rail. */}
                            <span className="absolute -left-[34px] top-3 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background font-mono text-[10px] font-semibold text-foreground">
                                {s.n}
                            </span>
                            <Card className="gap-0 bg-card/50 p-5">
                                <h3 className="font-mono text-sm font-semibold text-foreground">
                                    {s.title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    {s.body}
                                </p>
                            </Card>
                        </li>
                    ))}
                </ol>
            </section>

            {/* Design principles — 2-col grid of small claim cards. */}
            <section className="relative mx-auto max-w-5xl px-6 pb-16">
                <p className="mb-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Design principles
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                    {PRINCIPLES.map((p) => (
                        <Card key={p.title} className="gap-0 bg-card/50 p-5">
                            <p className="font-mono text-sm font-semibold text-foreground">{p.title}</p>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Under the hood — definition-list-style stack. */}
            <section className="relative mx-auto max-w-3xl px-6 pb-20">
                <p className="mb-6 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Under the hood
                </p>
                <Card className="gap-0 divide-y divide-border/60 bg-card/40 p-0">
                    {STACK.map((row) => (
                        <div key={row.label} className="grid grid-cols-[120px_1fr] gap-4 px-5 py-4">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                {row.label}
                            </span>
                            <p className="text-sm leading-relaxed text-foreground/90">{row.value}</p>
                        </div>
                    ))}
                </Card>
            </section>

            {/* Final CTA */}
            <section className="relative mx-auto max-w-3xl px-6 pb-20 text-center">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to try it?</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Paste a problem, paste your code, watch the pipeline stream back live.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                    <Link href={primaryCta.href} className={buttonVariants({ size: 'lg' })}>
                        {primaryCta.label}
                    </Link>
                    <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                        Back to home
                    </Link>
                </div>
            </section>

            <Footer />
        </div>
    );
}
