'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { reviewStream } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { ReviewResults } from '@/components/ReviewResults';
import { CodeEditor } from '@/components/CodeEditor';
import { LoadingState } from '@/components/ui/spinner';
import type {
    Stage,
    AnalyzerOutput,
    CriticOutput,
    ImproverOutput,
    EvaluatorOutput,
    LoopResult,
    TerminationReason,
} from '@/lib/types';

const LANGUAGES = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python',     label: 'Python'     },
    { value: 'go',         label: 'Go'         },
    { value: 'rust',       label: 'Rust'       },
    { value: 'java',       label: 'Java'       },
    { value: 'cpp',        label: 'C++'        },
];

const STAGES: ReadonlyArray<{ key: Stage; glyph: string; label: string }> = [
    { key: 'analyzer',  glyph: '01', label: 'Analyzer'  },
    { key: 'critic',    glyph: '02', label: 'Critic'    },
    { key: 'improver',  glyph: '03', label: 'Improver'  },
    { key: 'evaluator', glyph: '04', label: 'Evaluator' },
];

type RunState = 'idle' | 'running' | 'done' | 'error';

// One iteration's accumulated results, plus the code that was fed in.
export type IterationData = {
    iteration: number;
    inputCode: string;
    analyzer?:  AnalyzerOutput;
    critic?:    CriticOutput;
    improver?:  ImproverOutput;
    evaluator?: EvaluatorOutput;
};

type StageStatus = 'pending' | 'running' | 'complete';

function statusFor(
    stage: Stage,
    activeStage: Stage | null,
    iteration: IterationData | undefined,
): StageStatus {
    if (iteration?.[stage]) return 'complete';
    if (activeStage === stage) return 'running';
    return 'pending';
}

function summaryFor(stage: Stage, iter: IterationData | undefined): string | null {
    if (!iter) return null;
    switch (stage) {
        case 'analyzer': {
            if (!iter.analyzer) return null;
            const n = iter.analyzer.findings.length;
            return `${n} finding${n === 1 ? '' : 's'}`;
        }
        case 'critic': {
            if (!iter.critic) return null;
            const kept = iter.critic.reviewedFindings.filter((f) => f.decision !== 'drop').length;
            return `${kept}/${iter.critic.reviewedFindings.length} kept`;
        }
        case 'improver': {
            if (!iter.improver) return null;
            const n = iter.improver.changeNotes.length;
            return `${n} change${n === 1 ? '' : 's'}`;
        }
        case 'evaluator': {
            if (!iter.evaluator) return null;
            return iter.evaluator.verdict;
        }
    }
}

const TERMINATION_LABEL: Record<TerminationReason, string> = {
    converged:        'Converged — no more improvements possible',
    regressed:        'Stopped — last iteration regressed, rolled back',
    'no-findings':    'No issues to fix — code is clean',
    'max-iterations': 'Hit max iterations cap',
};

export default function ReviewPage() {
    const auth = useAuth();
    const router = useRouter();
    const { refreshRecents } = useSidebar();

    const [code, setCode] = useState('');
    const [language, setLanguage] = useState<string>('typescript');
    const [maxIterations, setMaxIterations] = useState<number>(3);

    // Stream state — now iteration-aware.
    const [runState, setRunState] = useState<RunState>('idle');
    const [activeIteration, setActiveIteration] = useState<number | null>(null);
    const [activeStage, setActiveStage] = useState<Stage | null>(null);
    const [iterations, setIterations] = useState<IterationData[]>([]);
    const [loopResult, setLoopResult] = useState<LoopResult | null>(null);
    // Run ID for the most recent completed run. Backs the toast action + the
    // "View saved →" link in the summary banner so the user has a clear
    // affordance to deep-link to /history/[id].
    const [savedRunId, setSavedRunId] = useState<string | null>(null);

    // Submit-time snapshot — anchors diff baselines & Discard reverts.
    const [originalCode, setOriginalCode] = useState('');
    const [originalLanguage, setOriginalLanguage] = useState<string>('typescript');

    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (auth.status === 'unauthenticated') router.replace('/login');
    }, [auth.status, router]);

    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    if (auth.status !== 'authenticated') {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
                <LoadingState
                    label={auth.status === 'loading' ? 'Loading' : 'Redirecting'}
                />
            </div>
        );
    }

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();

        setRunState('running');
        setActiveIteration(null);
        setActiveStage(null);
        setIterations([]);
        setLoopResult(null);
        setSavedRunId(null);
        setOriginalCode(code);
        setOriginalLanguage(language);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await reviewStream(
                { code, language, maxIterations },
                {
                    signal: controller.signal,
                    onEvent: (ev) => {
                        switch (ev.type) {
                            case 'loop_start':
                                // Nothing to set — reset already done above.
                                break;

                            case 'iteration_start':
                                setActiveIteration(ev.iteration);
                                setActiveStage(null);
                                // Pre-seed the iteration row so the sidebar can
                                // immediately render "Iter N · running" with
                                // empty stages.
                                setIterations((prev) => {
                                    if (prev.find((it) => it.iteration === ev.iteration)) return prev;
                                    return [
                                        ...prev,
                                        {
                                            iteration: ev.iteration,
                                            // We don't know the inputCode yet (server has it). For
                                            // iteration 1 it equals originalCode; for later iterations
                                            // it'll be set via the iteration_complete event.
                                            inputCode: ev.iteration === 1 ? code : '',
                                        },
                                    ];
                                });
                                break;

                            case 'stage_start':
                                setActiveIteration(ev.iteration);
                                setActiveStage(ev.stage);
                                break;

                            case 'stage_complete':
                                setIterations((prev) =>
                                    prev.map((it) =>
                                        it.iteration === ev.iteration
                                            ? { ...it, [ev.stage]: ev.result }
                                            : it,
                                    ),
                                );
                                setActiveStage((curr) => (curr === ev.stage ? null : curr));
                                break;

                            case 'iteration_complete':
                                // Authoritative copy — fill in any fields we
                                // didn't get from stage events (notably inputCode).
                                setIterations((prev) =>
                                    prev.map((it) =>
                                        it.iteration === ev.iteration
                                            ? {
                                                iteration: ev.iteration,
                                                inputCode: ev.result.inputCode,
                                                analyzer:  ev.result.findings,
                                                critic:    ev.result.reviewed,
                                                improver:  ev.result.improved,
                                                evaluator: ev.result.evaluation,
                                            }
                                            : it,
                                    ),
                                );
                                setActiveStage(null);
                                break;

                            case 'loop_complete':
                                setLoopResult(ev.result);
                                setActiveIteration(null);
                                setActiveStage(null);
                                break;

                            case 'done':
                                setLoopResult(ev.result);
                                setActiveIteration(null);
                                setActiveStage(null);
                                setRunState('done');
                                // Server persisted the run before sending `done`.
                                // Bump the sidebar to refetch its Recents list,
                                // capture the new runId for the View link, and
                                // toast a success with a deep-link action.
                                refreshRecents();
                                if (ev.runId) {
                                    const newRunId = ev.runId;
                                    setSavedRunId(newRunId);
                                    notifySuccess('Review saved to history', {
                                        description: 'Open the saved snapshot any time from the sidebar.',
                                        action: {
                                            label: 'View',
                                            onClick: () => router.push(`/history/${newRunId}`),
                                        },
                                    });
                                }
                                break;

                            case 'error':
                                setActiveIteration(null);
                                setActiveStage(null);
                                setRunState('error');
                                notifyError(ev.error, { description: 'The review stream returned an error.' });
                                break;
                        }
                    },
                },
            );
            setRunState((s) => (s === 'running' ? 'done' : s));
            // Belt-and-braces sidebar refresh — the `done` case above already
            // calls refreshRecents(), but if the event is dropped (network
            // glitch, parser miss) this guarantees the new row shows up.
            refreshRecents();
        } catch (err) {
            if (controller.signal.aborted) {
                setRunState('idle');
                setActiveIteration(null);
                setActiveStage(null);
                return;
            }
            setRunState('error');
            setActiveIteration(null);
            setActiveStage(null);
            notifyError(err, { description: 'Review failed. Please try again.' });
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
        }
    };

    const onCancel = () => abortRef.current?.abort();

    // Apply an iteration's improvedCode (Keep) or revert to its inputCode (Discard).
    // Each iteration card owns its own decision, so handlers take the iteration in.
    const onKeepIteration = (iter: IterationData) => {
        if (iter.improver) {
            setCode(iter.improver.improvedCode);
            setLanguage(originalLanguage);
        }
    };
    const onDiscardIteration = (iter: IterationData) => {
        setCode(iter.inputCode || originalCode);
        setLanguage(originalLanguage);
    };

    const canSubmit  = code.trim().length > 0 && runState !== 'running';
    const isRunning  = runState === 'running';
    const hasResults = iterations.length > 0;

    // The sidebar pipeline reflects the *currently active* iteration's stages,
    // or the latest completed iteration when nothing is running.
    const sidebarIteration: IterationData | undefined =
        activeIteration !== null
            ? iterations.find((it) => it.iteration === activeIteration)
            : iterations[iterations.length - 1];

    return (
        <div className="mx-auto max-w-6xl px-6 py-12">
            {/* Page heading */}
            <header className="animate-fade-up mb-10 space-y-2">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    New review
                </p>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Run a review.</h1>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Paste your code below. The agents will analyze, critique, improve, and evaluate it —
                    looping until the code converges or the iteration cap is reached.
                </p>
            </header>

            {/* Main grid: results main column on the left, sticky pipeline sidebar on the right */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
                {/* MAIN COLUMN — form + result panels stacked */}
                <div className="min-w-0 space-y-8">
                    {/* Input form */}
                    <Card
                        className="animate-fade-up gap-0 bg-card/50 p-6"
                        style={{ animationDelay: '80ms' }}
                    >
                        <form onSubmit={onSubmit} className="space-y-5">
                            {/* Language + Max iterations on the same row */}
                            <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                                <Label
                                    htmlFor="language"
                                    className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
                                >
                                    Language
                                </Label>
                                <select
                                    id="language"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    disabled={isRunning}
                                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                                >
                                    {LANGUAGES.map((l) => (
                                        <option key={l.value} value={l.value} className="bg-background">
                                            {l.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                                <Label
                                    htmlFor="maxIterations"
                                    className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
                                >
                                    Max iterations
                                </Label>
                                <div className="flex items-center gap-4">
                                    <input
                                        id="maxIterations"
                                        type="range"
                                        min={1}
                                        max={5}
                                        step={1}
                                        value={maxIterations}
                                        onChange={(e) => setMaxIterations(Number(e.target.value))}
                                        disabled={isRunning}
                                        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-input/50 accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <span className="w-8 shrink-0 text-right font-mono text-sm tabular-nums">
                                        {maxIterations}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label
                                        htmlFor="code"
                                        className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
                                    >
                                        Code
                                    </Label>
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                        {code.length.toLocaleString()} chars
                                    </span>
                                </div>
                                <div className="overflow-hidden rounded-lg border border-input bg-input/30 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                                    <CodeEditor
                                        value={code}
                                        onChange={setCode}
                                        language={language}
                                        readOnly={isRunning}
                                        height={320}
                                        placeholder="// paste your code here"
                                    />
                                </div>
                            </div>

                            {isRunning ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onCancel}
                                    className="h-10 w-full font-mono text-[15px]"
                                >
                                    Cancel
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className="h-10 w-full font-mono text-[15px]"
                                >
                                    {runState === 'done' || runState === 'error' ? 'Run again →' : 'Run review →'}
                                </Button>
                            )}
                        </form>
                    </Card>

                    {/* Saved-run affordance — visible once the server has
                        persisted the run and returned its id. */}
                    {savedRunId && runState === 'done' && (
                        <div className="flex items-center justify-between rounded-md border border-border/70 bg-card/40 px-3 py-2">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                Saved to history
                            </p>
                            <Link
                                href={`/history/${savedRunId}`}
                                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                            >
                                View saved →
                            </Link>
                        </div>
                    )}

                    {/* Results — iteration accordions */}
                    {hasResults && (
                        <ReviewResults
                            iterations={iterations}
                            language={originalLanguage}
                            loopResult={loopResult}
                            onKeep={onKeepIteration}
                            onDiscard={onDiscardIteration}
                        />
                    )}
                </div>

                {/* SIDEBAR — sticky pipeline status */}
                <aside className="lg:sticky lg:top-20 lg:self-start">
                    <Card
                        className="animate-fade-up gap-0 bg-card/50 p-5"
                        style={{ animationDelay: '160ms' }}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                                Pipeline
                            </p>
                            <p className={[
                                'font-mono text-[10px] uppercase tracking-widest',
                                runState === 'running' && 'text-foreground animate-pulse-soft',
                                runState === 'done'    && 'text-emerald-300',
                                runState === 'error'   && 'text-rose-300',
                                runState === 'idle'    && 'text-muted-foreground/60',
                            ].filter(Boolean).join(' ')}>
                                {runState === 'idle'    && 'Ready'}
                                {runState === 'running' && 'Streaming…'}
                                {runState === 'done'    && 'Complete'}
                                {runState === 'error'   && 'Failed'}
                            </p>
                        </div>

                        {/* Iteration indicator */}
                        {hasResults && (
                            <div className="mb-3 flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
                                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                    Iteration
                                </span>
                                <span className="ml-auto font-mono text-xs tabular-nums">
                                    {sidebarIteration?.iteration ?? '—'} / {maxIterations}
                                </span>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            {STAGES.map((s) => {
                                const status  = statusFor(s.key, activeStage, sidebarIteration);
                                const summary = summaryFor(s.key, sidebarIteration);
                                return (
                                    <div
                                        key={s.key}
                                        className={[
                                            'flex items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors',
                                            status === 'running'  && 'border-foreground/40 bg-background/60',
                                            status === 'complete' && 'border-emerald-500/30 bg-emerald-500/[0.04]',
                                            status === 'pending'  && 'border-border/60 bg-background/40',
                                        ].filter(Boolean).join(' ')}
                                    >
                                        <div
                                            className={[
                                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-background font-mono text-[10px] transition-colors',
                                                status === 'running'  && 'border-foreground text-foreground animate-pulse-soft',
                                                status === 'complete' && 'border-emerald-500/40 text-emerald-300',
                                                status === 'pending'  && 'border-border text-muted-foreground',
                                            ].filter(Boolean).join(' ')}
                                        >
                                            {s.glyph}
                                        </div>
                                        <span
                                            className={[
                                                'font-mono text-xs transition-colors',
                                                status === 'complete' ? 'text-foreground' : '',
                                                status === 'pending'  ? 'text-muted-foreground' : '',
                                            ].join(' ')}
                                        >
                                            {s.label}
                                        </span>
                                        <span
                                            className={[
                                                'ml-auto font-mono text-[10px] uppercase tracking-widest transition-colors',
                                                status === 'running'  && 'text-foreground animate-pulse-soft',
                                                status === 'complete' && 'text-emerald-300',
                                                status === 'pending'  && 'text-muted-foreground/60',
                                            ].filter(Boolean).join(' ')}
                                        >
                                            {status === 'complete' && (summary ?? '✓')}
                                            {status === 'running'  && '…'}
                                            {status === 'pending'  && '—'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer — termination reason once the loop finishes */}
                        <p className="mt-4 border-t border-border/60 pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                            {isRunning
                                ? 'Streaming live from the agents.'
                                : runState === 'done' && loopResult
                                    ? TERMINATION_LABEL[loopResult.terminationReason]
                                    : runState === 'error'
                                        ? 'A stage failed — try again.'
                                        : 'Paste code and run a review.'}
                        </p>
                    </Card>
                </aside>
            </div>
        </div>
    );
}
