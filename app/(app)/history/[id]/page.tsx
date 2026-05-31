'use client';

// Historic run detail. Fetches a single Run + its iterations from the
// backend and renders them through the same ReviewResults component the
// live review page uses — so a past run looks identical to a fresh one
// (same accordions, same expanded-final-iteration default).
//
// The route is wired to the sidebar's Recents list (each row links here).
// Auth is enforced server-side; on 401/404 we redirect or show a stub.

import { useEffect, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiRequestError } from '@/lib/api';
import { LoadingState } from '@/components/ui/spinner';
import { Card } from '@/components/ui/card';
import { ReviewResults, FinalEvaluation } from '@/components/ReviewResults';
import { TestCasePanel } from '@/components/TestCasePanel';
import type { IterationData } from '@/app/(app)/review/page';
import type { RunDetail, LoopResult } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export default function HistoryDetailPage({ params }: Props) {
    const { id } = usePromise(params);
    const auth = useAuth();
    const router = useRouter();

    const [run, setRun]     = useState<RunDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (auth.status === 'unauthenticated') {
            router.replace('/login');
            return;
        }
        if (auth.status !== 'authenticated') return;

        let cancelled = false;
        api.getRun(id)
            .then((r) => { if (!cancelled) setRun(r.run); })
            .catch((err: unknown) => {
                if (cancelled) return;
                if (err instanceof ApiRequestError && err.status === 404) {
                    setError('This review no longer exists.');
                } else {
                    setError('Could not load this review. Try again in a moment.');
                }
            });
        return () => { cancelled = true; };
    }, [id, auth.status, router]);

    if (auth.status !== 'authenticated') {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <LoadingState label="Loading" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-16 text-center">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Review unavailable
                </p>
                <p className="mt-3 text-sm text-foreground/80">{error}</p>
                <Link
                    href="/review"
                    className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-3 w-3" /> Back to new review
                </Link>
            </div>
        );
    }

    if (!run) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <LoadingState label="Loading review" />
            </div>
        );
    }

    const iterations: IterationData[] = run.iterations.map((it) => ({
        iteration:    it.iterationIndex,
        inputCode:    it.inputCode,
        analyzer:     it.analyzerOutput,
        critic:       it.criticOutput,
        improver:     it.improverOutput,
        testPassRate: it.testPassRate,
    }));

    const loopResult: LoopResult = {
        iterations: iterations.map((it) => ({
            iteration:    it.iteration,
            inputCode:    it.inputCode,
            findings:     it.analyzer!,
            reviewed:     it.critic!,
            improved:     it.improver!,
            testResults:  it.testResults ?? [],
            testPassRate: it.testPassRate ?? null,
        })),
        finalCode:         run.finalCode,
        terminationReason: run.terminationReason,
        testCases:         run.testCases.map((c) => ({ name: c.name, input: c.input, expectedOutput: c.expectedOutput })),
        testPassRate:      run.testPassRate ?? null,
        finalResults:      [],
        finalEvaluation:   run.finalEvaluation ?? null,
    };

    return (
        <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:py-12">
            <header className="mb-8">
                <Link
                    href="/review"
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-3 w-3" /> New review
                </Link>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight">{run.title}</h1>
                <p className="mt-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {run.language} · {run.iterationsRun} iteration{run.iterationsRun === 1 ? '' : 's'}
                    {' · '}
                    {new Date(run.createdAt).toLocaleString()}
                </p>
            </header>

            {/* Problem statement — present on post-pivot runs only. Legacy
                generic-review runs render without this card. Scroll inside
                the card so a long statement doesn't push the iteration view
                below the fold. */}
            {run.problemStatement && (
                <Card className="mb-6 gap-0 bg-card/50 p-5">
                    <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Problem statement
                    </p>
                    <div className="themed-scrollbar max-h-64 overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground/90">
                        {run.problemStatement}
                    </div>
                </Card>
            )}

            <ReviewResults
                iterations={iterations}
                language={run.language}
                loopResult={loopResult}
            />

            {/* Phase 2.4+ runs always have testCases; legacy runs render an empty list. */}
            <TestCasePanel
                runId={run.id}
                initialCases={run.testCases}
                initialResults={run.testResults}
            />

            {/* Final verdict — rendered last, after everything else. */}
            {run.finalEvaluation && (
                <FinalEvaluation data={run.finalEvaluation} />
            )}
        </div>
    );
}
