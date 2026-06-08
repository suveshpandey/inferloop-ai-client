'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Repeat, Check, AlertTriangle, CircleDashed } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { api, reviewStream, ApiRequestError } from '@/lib/api';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, placeholderFor } from '@/lib/languages';
import { notifyError, notifySuccess } from '@/lib/notify';
import { ReviewResults, FinalEvaluation } from '@/components/ReviewResults';
import { TestCasePanel } from '@/components/TestCasePanel';
import { CodeEditor } from '@/components/CodeEditor';
import { LoadingState } from '@/components/ui/spinner';
import type {
    Stage,
    AnalyzerOutput,
    CriticOutput,
    ImproverOutput,
    LiveTestResult,
    LoopResult,
    RunDetail,
    TestCaseSpec,
    TerminationReason,
} from '@/lib/types';

// Backend requirement (z.string().min(10)). Mirrored here so the submit button
// disables on too-short input instead of letting a request fail at the API.
const PROBLEM_STATEMENT_MIN = 10;

// Per-iteration pipeline: three LLM agents + a sandbox tests step. The
// Evaluator runs once at the end (shown separately, below the pipeline).
type PipelineStage = 'analyzer' | 'critic' | 'improver' | 'tests';

// Glyphs match the canonical 5-agent landing-page numbering (01–05) — the
// pre-loop test generator is 01, per-iteration agents are 02–04, the post-loop
// evaluator is 05. The sandbox-tests sub-step uses the non-numeric "T" glyph
// since it's infra, not an LLM agent.
const STAGES: ReadonlyArray<{ key: PipelineStage; glyph: string; label: string }> = [
    { key: 'analyzer',  glyph: '02', label: 'Analyzer'  },
    { key: 'critic',    glyph: '03', label: 'Critic'    },
    { key: 'improver',  glyph: '04', label: 'Improver'  },
    { key: 'tests',     glyph: 'T',  label: 'Testing'   },
];

type RunState = 'idle' | 'running' | 'done' | 'error';

// One iteration's accumulated results, plus the code that was fed in.
export type IterationData = {
    iteration: number;
    inputCode: string;
    analyzer?:    AnalyzerOutput;
    critic?:      CriticOutput;
    improver?:    ImproverOutput;
    testPassRate?: number | null;
    testResults?:  LiveTestResult[];
};

type StageStatus = 'pending' | 'running' | 'complete';

function statusFor(
    stage: PipelineStage,
    activeStage: Stage | null,
    iteration: IterationData | undefined,
    testsRunningFor: number | null,
): StageStatus {
    if (stage === 'tests') {
        // Complete once iteration_complete arrives with results (or null pass-rate
        // if the sandbox failed); running while between improver done and that.
        if (iteration && (iteration.testResults !== undefined || iteration.testPassRate !== undefined)) {
            return 'complete';
        }
        if (iteration && testsRunningFor === iteration.iteration) return 'running';
        return 'pending';
    }
    if (iteration?.[stage]) return 'complete';
    if (activeStage === stage) return 'running';
    return 'pending';
}

function summaryFor(stage: PipelineStage, iter: IterationData | undefined): string | null {
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
        case 'tests': {
            if (iter.testPassRate === undefined) return null;
            if (iter.testPassRate === null) return 'skipped';
            const passed = iter.testResults?.filter((r) => r.passed).length ?? 0;
            const total  = iter.testResults?.length ?? 0;
            return total > 0 ? `${passed}/${total}` : `${iter.testPassRate}%`;
        }
    }
}

const TERMINATION_LABEL: Record<TerminationReason, string> = {
    'all-pass':       'All tests pass — solution is correct',
    stalled:          'Stopped — pass-rate stopped improving',
    'no-findings':    'No issues to fix — code is clean',
    'max-iterations': 'Hit max iterations cap',
    converged:        'Converged — no more improvements possible',
    regressed:        'Stopped — last iteration regressed, rolled back',
};

export default function ReviewPage() {
    const auth = useAuth();
    const router = useRouter();
    const { refreshRecents, newReviewVersion } = useSidebar();

    const [code, setCode] = useState('');
    const [language, setLanguage] = useState<string>(DEFAULT_LANGUAGE);
    const [problemStatement, setProblemStatement] = useState('');
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
    // Full saved run, fetched after `done`, so we can render the TestCasePanel
    // inline with DB-shaped cases/results (the panel needs stable testCaseIds).
    const [savedRun, setSavedRun] = useState<RunDetail | null>(null);

    // Live test-generation status. `generating` between loop_start and
    // tests_generated; `ready` once we know the count. Surfaces "tests are
    // happening" feedback the user otherwise wouldn't see.
    const [testsStatus, setTestsStatus] = useState<'idle' | 'generating' | 'ready'>('idle');
    const [testsCount,  setTestsCount]  = useState<number>(0);
    // The actual generated cases, rendered as soon as tests_generated fires so
    // the user can see what their code is being tested against.
    const [liveCases, setLiveCases] = useState<TestCaseSpec[]>([]);
    // Iteration whose tests are currently executing in the sandbox — set on
    // tests_running, cleared on iteration_complete.
    const [testsRunningFor, setTestsRunningFor] = useState<number | null>(null);
    // Final Evaluator status. running between final_evaluation_starting and
    // final_evaluation; done once the verdict is in.
    const [finalEvalStatus, setFinalEvalStatus] = useState<'idle' | 'running' | 'done'>('idle');
    // Per-case live status for the iteration currently executing tests. Keyed
    // by caseIndex. Reset every time a new iteration starts running tests so
    // the panel shows the CURRENT pass through.
    const [caseLiveStatus, setCaseLiveStatus] = useState<Record<number, 'running' | LiveTestResult>>({});

    // Submit-time snapshot — anchors diff baselines & Discard reverts.
    const [originalCode, setOriginalCode] = useState('');
    const [originalLanguage, setOriginalLanguage] = useState<string>(DEFAULT_LANGUAGE);

    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (auth.status === 'unauthenticated') router.replace('/login');
    }, [auth.status, router]);

    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    // "New review" button in the sidebar bumps newReviewVersion. When that
    // happens (and we're already mounted), wipe all in-memory state so the
    // user lands on a clean editor without needing to refresh the page.
    // Skipping the very first run keeps the initial mount untouched.
    const didMountRef = useRef(false);
    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }
        abortRef.current?.abort();
        abortRef.current = null;
        setCode('');
        setProblemStatement('');
        setOriginalCode('');
        setOriginalLanguage(language);
        setIterations([]);
        setLoopResult(null);
        setSavedRunId(null);
        setSavedRun(null);
        setTestsStatus('idle');
        setTestsCount(0);
        setLiveCases([]);
        setTestsRunningFor(null);
        setFinalEvalStatus('idle');
        setCaseLiveStatus({});
        setActiveIteration(null);
        setActiveStage(null);
        setRunState('idle');
    }, [newReviewVersion]);  // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch the just-saved run after `done` so the live page can render the
    // interactive TestCasePanel (which needs DB-shaped cases/results with ids).
    useEffect(() => {
        if (!savedRunId) return;
        let cancelled = false;
        api.getRun(savedRunId)
            .then((r) => { if (!cancelled) setSavedRun(r.run); })
            .catch(() => { /* non-fatal — panel just doesn't render */ });
        return () => { cancelled = true; };
    }, [savedRunId]);

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
        setSavedRun(null);
        setTestsStatus('idle');
        setTestsCount(0);
        setLiveCases([]);
        setTestsRunningFor(null);
        setFinalEvalStatus('idle');
        setCaseLiveStatus({});
        setOriginalCode(code);
        setOriginalLanguage(language);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await reviewStream(
                { code, language, problemStatement, maxIterations },
                {
                    signal: controller.signal,
                    onEvent: (ev) => {
                        switch (ev.type) {
                            case 'loop_start':
                                // Generation kicks off before iteration 1 — show the live
                                // "generating tests…" hint until the count arrives.
                                setTestsStatus('generating');
                                break;

                            case 'tests_generated':
                                setTestsCount(ev.count);
                                setLiveCases(ev.cases);
                                setTestsStatus('ready');
                                break;

                            case 'tests_running':
                                setTestsRunningFor(ev.iteration);
                                // Reset the per-case panel so the user sees a fresh
                                // pass for the current iteration.
                                setCaseLiveStatus({});
                                break;

                            case 'test_case_start':
                                setCaseLiveStatus((prev) => ({ ...prev, [ev.caseIndex]: 'running' }));
                                break;

                            case 'test_case_complete':
                                setCaseLiveStatus((prev) => ({ ...prev, [ev.result.caseIndex]: ev.result }));
                                break;

                            case 'final_evaluation_starting':
                                setFinalEvalStatus('running');
                                break;

                            case 'final_evaluation':
                                setFinalEvalStatus('done');
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
                                                testPassRate: ev.result.testPassRate,
                                                testResults:  ev.result.testResults,
                                            }
                                            : it,
                                    ),
                                );
                                setActiveStage(null);
                                setTestsRunningFor(null);
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
            if (err instanceof ApiRequestError && err.status === 429) {
                setRunState('idle');
                setActiveIteration(null);
                setActiveStage(null);
                notifyError(err);
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

    const canSubmit =
        code.trim().length > 0 &&
        problemStatement.trim().length >= PROBLEM_STATEMENT_MIN &&
        runState !== 'running';
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
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Review a DSA / CP submission.</h1>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Paste the problem statement and your candidate solution (Python or C++). The agents
                    will analyze for correctness and complexity, critique their own findings, rewrite
                    toward an optimal solution, and judge whether the rewrite is actually better.
                </p>
            </header>

            {/* Main grid: results main column on the left, sticky pipeline sidebar on the right */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
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
                                    {SUPPORTED_LANGUAGES.map((l) => (
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

                            {/* Problem statement — required. The agents reason
                                against this on every iteration; constraints
                                (n ≤ 10^5, time limit) drive the complexity
                                verdict. Min 10 chars mirrors the backend Zod
                                rule so the button disables before the network
                                round-trip. */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label
                                        htmlFor="problemStatement"
                                        className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
                                    >
                                        Problem statement
                                    </Label>
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                        {problemStatement.length.toLocaleString()} chars
                                    </span>
                                </div>
                                <Textarea
                                    id="problemStatement"
                                    value={problemStatement}
                                    onChange={(e) => setProblemStatement(e.target.value)}
                                    disabled={isRunning}
                                    rows={6}
                                    placeholder="Paste the full problem statement, including constraints (n ≤ …, time limit, value ranges). The reviewer needs the constraints to judge if your algorithm is fast enough."
                                    className="font-mono text-sm leading-relaxed"
                                />
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
                                        placeholder={placeholderFor(language)}
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

                    {/* Generated test cases — visible the moment generation
                        completes, so the user sees what their code is being
                        tested against. Per-iteration pass/fail lives inside
                        each iteration card below. */}
                    {liveCases.length > 0 && (
                        <LiveTestCases cases={liveCases} liveStatus={caseLiveStatus} />
                    )}

                    {/* Results — iteration accordions */}
                    {hasResults && (
                        <ReviewResults
                            iterations={iterations}
                            language={originalLanguage}
                            loopResult={loopResult}
                            onKeep={onKeepIteration}
                            onDiscard={onDiscardIteration}
                            liveCases={liveCases}
                            caseLiveStatus={caseLiveStatus}
                            testsRunningFor={testsRunningFor}
                        />
                    )}

                    {/* Tests were generated but the sandbox couldn't run them
                        during the loop (typically a C++ cold-start timeout or
                        a transient Vercel hiccup). Surface it so degradation
                        isn't silent — the panel below works on retry. */}
                    {runState === 'done' && testsCount > 0 && loopResult?.testPassRate === null && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3">
                            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700/70 dark:text-amber-200/70">
                                Tests didn't run during the loop
                            </p>
                            <p className="text-sm text-amber-700 dark:text-amber-200">
                                The sandbox was unavailable while the agents were running. Use the panel below to run the {testsCount} generated case{testsCount === 1 ? '' : 's'} — it usually succeeds on a retry.
                            </p>
                        </div>
                    )}

                    {/* Live test-case panel — fully interactive once the run
                        is saved (stable runId). Same component as the history
                        page, given the freshly-fetched RunDetail. */}
                    {savedRun && (
                        <TestCasePanel
                            runId={savedRun.id}
                            initialCases={savedRun.testCases}
                            initialResults={savedRun.testResults}
                        />
                    )}

                    {/* Final verdict — rendered last, after everything else. */}
                    {loopResult?.finalEvaluation && (
                        <FinalEvaluation data={loopResult.finalEvaluation} />
                    )}
                </div>

                {/* SIDEBAR — sticky pipeline status, rail-based timeline */}
                <aside className="lg:sticky lg:top-20 lg:self-start">
                    <Card
                        className="animate-fade-up gap-0 bg-card/50 p-5"
                        style={{ animationDelay: '160ms' }}
                    >
                        {/* Header — title + run-state pill */}
                        <div className="mb-5 flex items-center justify-between">
                            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                                Pipeline
                            </p>
                            <RunStatePill state={runState} />
                        </div>

                        {/* Timeline rail — single column with absolutely-
                            positioned status dots on a vertical line. One
                            section per group: pre-loop (01), loop (02–T), and
                            post-loop terminal (05). */}
                        <div className="relative pl-7">
                            {/* the rail itself — base track */}
                            <span
                                className="absolute left-[11px] top-1 bottom-1 w-px bg-gradient-to-b from-border/40 via-border/70 to-border/40"
                                aria-hidden
                            />
                            {/* progress fill — emerald section grows downward
                                as nodes complete. Computed from the same status
                                logic the nodes use, so they stay in sync. */}
                            <RailProgressFill
                                fraction={computeProgressFraction({
                                    testsStatus,
                                    activeStage,
                                    sidebarIteration,
                                    testsRunningFor,
                                    finalEvalStatus,
                                })}
                            />

                            {/* 01 — Test generation */}
                            <PipelineNode
                                glyph="01"
                                label="Test generation"
                                status={
                                    testsStatus === 'ready'      ? 'complete' :
                                    testsStatus === 'generating' ? 'running'  :
                                                                   'pending'
                                }
                                meta={
                                    testsStatus === 'ready'
                                        ? `${testsCount} case${testsCount === 1 ? '' : 's'}`
                                        : testsStatus === 'generating'
                                            ? 'generating…'
                                            : null
                                }
                            />

                            {/* Loop section header — a quiet inline label
                                that breaks the rail into "what cycles" without
                                a heavy bordered wrapper. */}
                            <LoopSectionLabel
                                iteration={sidebarIteration?.iteration ?? null}
                                maxIterations={maxIterations}
                                active={isRunning}
                            />

                            {/* Per-iteration stages (02 → T) */}
                            {STAGES.map((s, idx) => {
                                const status  = statusFor(s.key, activeStage, sidebarIteration, testsRunningFor);
                                const summary = summaryFor(s.key, sidebarIteration);

                                // Show the live current-case detail right
                                // under the Testing row (last loop stage)
                                // so it reads as that step's detail.
                                let detail: string | null = null;
                                if (s.key === 'tests' &&
                                    testsRunningFor !== null &&
                                    testsRunningFor === sidebarIteration?.iteration) {
                                    for (let i = 0; i < liveCases.length; i++) {
                                        if (caseLiveStatus[i] === 'running') {
                                            detail = `case ${i + 1}/${liveCases.length}: ${liveCases[i]?.name ?? ''}`;
                                            break;
                                        }
                                    }
                                }

                                return (
                                    <PipelineNode
                                        key={s.key}
                                        glyph={s.glyph}
                                        label={s.label}
                                        status={status}
                                        meta={
                                            status === 'complete' ? (summary ?? null) :
                                            status === 'running'  ? 'running…'        :
                                                                    null
                                        }
                                        detail={detail}
                                        isLastInGroup={idx === STAGES.length - 1}
                                    />
                                );
                            })}

                            {/* Loop closing hint — only while there are more
                                iterations possible and the run hasn't ended. */}
                            {(sidebarIteration?.iteration ?? 0) < maxIterations && runState !== 'done' && (
                                <div className="-ml-7 my-2 flex items-center gap-2 pl-7">
                                    <span className="h-px w-3 bg-border/60" />
                                    <span className="font-mono text-[10px] lowercase tracking-wider text-muted-foreground/60 italic">
                                        cycles until converged
                                    </span>
                                    <span className="h-px flex-1 bg-gradient-to-r from-border/40 via-border/20 to-transparent" />
                                </div>
                            )}

                            {/* 05 — Final evaluator, the terminal node */}
                            <PipelineNode
                                glyph="05"
                                label="Final evaluator"
                                status={
                                    finalEvalStatus === 'done'    ? 'complete' :
                                    finalEvalStatus === 'running' ? 'running'  :
                                                                    'pending'
                                }
                                meta={
                                    finalEvalStatus === 'done'
                                        ? (loopResult?.finalEvaluation?.verdict ?? null)
                                        : finalEvalStatus === 'running'
                                            ? 'evaluating…'
                                            : null
                                }
                                terminal
                            />
                        </div>

                        {/* Footer — status strip with an icon. Replaces the
                            tiny muted uppercase line, which read as a caption
                            instead of a verdict. */}
                        <PipelineFooter
                            runState={runState}
                            loopResult={loopResult}
                            isRunning={isRunning}
                        />
                    </Card>
                </aside>
            </div>
        </div>
    );
}

// ─────────────────────────── Pipeline primitives ──────────────────────────
//
// Rail-based timeline: each node renders as a row with an absolutely-
// positioned dot anchored to a shared vertical rail (drawn by the parent).
// Compared to bordered tiles + connectors, this gives a single continuous
// flow and removes the visual noise of identical filled rectangles when
// every stage completes.

type NodeStatus = 'pending' | 'running' | 'complete';

function PipelineNode({
    glyph,
    label,
    status,
    meta,
    detail,
    terminal,
    isLastInGroup: _isLastInGroup,
}: {
    glyph:    string;
    label:    string;
    status:   NodeStatus;
    meta?:    string | null;
    detail?:  string | null;
    terminal?: boolean;
    isLastInGroup?: boolean;
}) {
    void _isLastInGroup;
    return (
        <div
            className={[
                'group relative -mx-2 rounded-md px-2 py-2.5 transition-colors',
                status === 'running' && 'bg-foreground/[0.035]',
            ].filter(Boolean).join(' ')}
        >
            {/* Dot on the rail. Sits at left:-7 → -7+11=4 from row start, which
                centers it on the rail line drawn at absolute left:11px in the
                parent (rail is 1px wide, dot is 9px → offset = 11 - 4 = 7).
                We add a soft halo ring on running/complete to make the dot
                feel anchored to the rail rather than floating on it. */}
            <span aria-hidden className="absolute left-[-13px] top-3.5">
                {/* halo / ring */}
                <span
                    className={[
                        'absolute inset-[-5px] rounded-full transition-opacity',
                        status === 'running'  && 'bg-foreground/15 animate-pulse-soft',
                        status === 'complete' && 'bg-emerald-500/15',
                        status === 'pending'  && 'opacity-0',
                        terminal && status === 'complete' && 'inset-[-7px] bg-emerald-500/20',
                    ].filter(Boolean).join(' ')}
                />
                {/* the dot itself */}
                <span
                    className={[
                        'relative flex h-[9px] w-[9px] items-center justify-center rounded-full border transition-colors',
                        status === 'complete' && 'border-emerald-400 bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]',
                        status === 'running'  && 'border-foreground bg-foreground',
                        status === 'pending'  && 'border-border bg-background',
                        terminal              && status === 'complete' && 'h-[11px] w-[11px]',
                    ].filter(Boolean).join(' ')}
                />
            </span>

            {/* Row content */}
            <div className="flex items-center gap-2.5">
                {/* Glyph chip — gives 01/02/T a part-number feel, with the
                    border subtly tracking the node's status. */}
                <span
                    className={[
                        'flex h-[18px] min-w-[22px] items-center justify-center rounded-[5px] border px-1 font-mono text-[10px] tabular-nums tracking-widest transition-colors',
                        status === 'pending'  && 'border-border/60 bg-background/40 text-muted-foreground/55',
                        status === 'running'  && 'border-foreground/30 bg-foreground/[0.04] text-foreground',
                        status === 'complete' && 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300',
                    ].filter(Boolean).join(' ')}
                >
                    {glyph}
                </span>
                <span
                    className={[
                        'font-mono text-[13px] transition-colors',
                        status === 'pending'  && 'text-muted-foreground/60',
                        status === 'running'  && 'text-foreground',
                        status === 'complete' && 'text-foreground',
                        terminal && 'font-medium tracking-tight',
                    ].filter(Boolean).join(' ')}
                >
                    {label}
                </span>
                {/* Meta — small pill when complete (more "fact"-like than
                    plain text), italicized soft text when running, dot when
                    pending. */}
                {status === 'complete' && meta ? (
                    <span className="ml-auto shrink-0 whitespace-nowrap rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-2 py-[1px] font-mono text-[10px] tabular-nums lowercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        {meta}
                    </span>
                ) : status === 'running' ? (
                    <span className="ml-auto shrink-0 whitespace-nowrap font-mono text-[10px] lowercase tracking-wider text-foreground/70 animate-pulse-soft">
                        {meta ?? 'running…'}
                    </span>
                ) : (
                    <span className="ml-auto shrink-0 font-mono text-[10px] tracking-wider text-muted-foreground/30">
                        ·
                    </span>
                )}
            </div>

            {/* Optional detail line — used for the live "case 3/6: name" hint
                under the Testing row. */}
            {detail && (
                <p className="mt-1 ml-[30px] rounded border-l border-foreground/20 pl-2 font-mono text-[10px] text-foreground/75 animate-pulse-soft">
                    {detail}
                </p>
            )}
        </div>
    );
}

// Emerald progress overlay on top of the base rail. `fraction` is 0..1 —
// 0 nothing complete, 1 final-evaluator done. Positioned identically to
// the base rail, height scaled to the fraction.
function RailProgressFill({ fraction }: { fraction: number }) {
    const pct = Math.max(0, Math.min(1, fraction)) * 100;
    if (pct === 0) return null;
    return (
        <span
            aria-hidden
            className="absolute left-[11px] top-1 w-px bg-gradient-to-b from-emerald-500/70 via-emerald-500/50 to-emerald-500/20 transition-[height] duration-500 ease-out"
            style={{ height: `calc(${pct}% - 0.5rem)` }}
        />
    );
}

// Compute how far down the rail the "completed" emerald fill should reach.
// 6 anchor points: 01 (test gen), 02 (analyzer), 03 (critic), 04 (improver),
// T (tests), 05 (final). We award partial credit for the running step so the
// fill visually leads the running dot rather than lagging behind it.
function computeProgressFraction({
    testsStatus,
    activeStage,
    sidebarIteration,
    testsRunningFor,
    finalEvalStatus,
}: {
    testsStatus:      'idle' | 'generating' | 'ready';
    activeStage:      Stage | null;
    sidebarIteration: IterationData | undefined;
    testsRunningFor:  number | null;
    finalEvalStatus:  'idle' | 'running' | 'done';
}): number {
    const ANCHORS = 6;
    let done = 0;
    let running = 0;
    if (testsStatus === 'ready') done++;
    else if (testsStatus === 'generating') running++;
    for (const k of ['analyzer', 'critic', 'improver'] as const) {
        if (sidebarIteration?.[k]) done++;
        else if (activeStage === k) running++;
    }
    const testsComplete =
        sidebarIteration &&
        (sidebarIteration.testResults !== undefined || sidebarIteration.testPassRate !== undefined);
    if (testsComplete) done++;
    else if (testsRunningFor !== null && testsRunningFor === sidebarIteration?.iteration) running++;
    if (finalEvalStatus === 'done') done++;
    else if (finalEvalStatus === 'running') running++;
    return (done + running * 0.5) / ANCHORS;
}

// Quiet inline section header that breaks the rail between Test generation
// and the per-iteration stages — communicates "what follows cycles" without
// the heavy dashed-border wrapper.
function LoopSectionLabel({
    iteration,
    maxIterations,
    active,
}: {
    iteration:     number | null;
    maxIterations: number;
    active:        boolean;
}) {
    return (
        <div className="-ml-7 my-2 flex items-center gap-2 pl-7">
            <span
                className={[
                    'flex h-[18px] items-center gap-1 rounded-full border px-1.5 font-mono text-[9px] uppercase tracking-widest transition-colors',
                    active
                        ? 'border-foreground/30 bg-foreground/[0.05] text-foreground'
                        : 'border-border/60 bg-background/40 text-muted-foreground/80',
                ].join(' ')}
            >
                <Repeat className={`h-2.5 w-2.5 ${active ? 'animate-pulse-soft' : ''}`} />
                Loop
            </span>
            <span className="font-mono text-[10px] tabular-nums text-foreground/75">
                {iteration ?? '—'}<span className="text-muted-foreground/50"> / </span>{maxIterations}
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-border/70 via-border/40 to-transparent" />
        </div>
    );
}

// Compact pill in the card header that reflects overall run state. Replaces
// the muted uppercase text label so it actually reads as a status indicator.
function RunStatePill({ state }: { state: RunState }) {
    const cls =
        state === 'running' ? 'border-foreground/40 bg-background/60 text-foreground animate-pulse-soft' :
        state === 'done'    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' :
        state === 'error'   ? 'border-rose-500/40   bg-rose-500/10   text-rose-700   dark:text-rose-300' :
                              'border-border/60     bg-background/40 text-muted-foreground/70';
    const label =
        state === 'running' ? 'Streaming' :
        state === 'done'    ? 'Complete'  :
        state === 'error'   ? 'Failed'    :
                              'Ready';
    return (
        <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${cls}`}>
            {label}
        </span>
    );
}

// Bottom strip — a clearly-styled outcome line with an icon. Replaces the
// faint muted caption so the verdict reads as a verdict.
function PipelineFooter({
    runState,
    loopResult,
    isRunning,
}: {
    runState:   RunState;
    loopResult: LoopResult | null;
    isRunning:  boolean;
}) {
    if (runState === 'idle') {
        return (
            <p className="mt-5 border-t border-border/60 pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                Paste the problem and your solution to start.
            </p>
        );
    }
    if (isRunning) {
        return (
            <p className="mt-5 flex items-center gap-2 border-t border-border/60 pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <CircleDashed className="h-3 w-3 animate-spin text-foreground/70" />
                Streaming live from the agents…
            </p>
        );
    }
    if (runState === 'error') {
        return (
            <div className="mt-5 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-rose-700 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p className="font-mono text-[11px] leading-relaxed">
                    A stage failed — try again.
                </p>
            </div>
        );
    }
    if (runState === 'done' && loopResult) {
        const reason = loopResult.terminationReason;
        const isPositive = reason === 'all-pass' || reason === 'no-findings';
        const isWarn     = reason === 'regressed';
        const Icon = isPositive ? Check : (isWarn ? AlertTriangle : Repeat);
        const tone =
            isPositive ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-800 dark:text-emerald-200' :
            isWarn     ? 'border-amber-500/30   bg-amber-500/[0.07]   text-amber-800   dark:text-amber-200'   :
                         'border-border/60      bg-background/40      text-foreground/85';
        return (
            <div className={`mt-5 flex items-start gap-2 rounded-md border px-3 py-2 ${tone}`}>
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p className="font-mono text-[11px] leading-relaxed">
                    {TERMINATION_LABEL[reason]}
                </p>
            </div>
        );
    }
    return null;
}

// ─────────────────────── Live generated test-cases list ──────────────────────
//
// Read-only — shows the cases the test-generator agent emitted, the moment
// they're available. Per-iteration pass/fail is rendered inside each iteration
// card; this section just answers "what are we even testing against?".

function LiveTestCases({
    cases,
    liveStatus,
}: {
    cases: TestCaseSpec[];
    liveStatus: Record<number, 'running' | LiveTestResult>;
}) {
    const [expanded, setExpanded] = useState<number | null>(null);
    const running = Object.values(liveStatus).some((s) => s === 'running');
    return (
        <Card className="animate-fade-up gap-0 bg-card/40 p-5">
            <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Generated test cases
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className={`font-mono text-[10px] uppercase tracking-widest ${running ? 'text-foreground animate-pulse-soft' : 'text-muted-foreground'}`}>
                    {running ? 'running…' : `${cases.length} case${cases.length === 1 ? '' : 's'}`}
                </span>
            </div>
            <ul className="space-y-1.5">
                {cases.map((c, i) => {
                    const open   = expanded === i;
                    const status = liveStatus[i];
                    return (
                        <li key={i} className="overflow-hidden rounded-md border border-border/60 bg-background/40">
                            <button
                                type="button"
                                onClick={() => setExpanded(open ? null : i)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                            >
                                <span className="font-mono text-[9px] uppercase tracking-widest text-sky-700 dark:text-sky-200">
                                    AI
                                </span>
                                <span className="truncate font-mono text-sm">{c.name}</span>
                                <LiveStatusBadge status={status} />
                                {c.category && status === undefined && (
                                    <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                        {c.category}
                                    </span>
                                )}
                            </button>
                            {open && (
                                <div className="grid gap-3 border-t border-border/60 bg-background/30 px-3 py-3 sm:grid-cols-2">
                                    <IoBlock label="Input" text={c.input} />
                                    <IoBlock label="Expected" text={c.expectedOutput} />
                                    {status && status !== 'running' && !status.passed && (
                                        <div className="sm:col-span-2">
                                            <IoBlock
                                                label={status.errorReason === 'wrong_answer' ? 'Actual output' : 'Stderr / error'}
                                                text={(status.errorReason === 'wrong_answer' ? status.actualOutput : (status.stderr || status.errorReason)) || '(no output)'}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

// Per-case live status indicator: empty when not yet run, pulsing "running…"
// while executing, green "pass" or red error reason once complete.
function LiveStatusBadge({ status }: { status: 'running' | LiveTestResult | undefined }) {
    if (status === undefined) return null;
    if (status === 'running') {
        return (
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-foreground animate-pulse-soft">
                running…
            </span>
        );
    }
    const reasonLabel = LIVE_REASON_LABEL[status.errorReason] ?? status.errorReason;
    return (
        <span
            className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                status.passed
                    ? 'border border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                    : 'border border-rose-500/50    bg-rose-500/10    text-rose-800    dark:text-rose-200'
            }`}
        >
            {status.passed ? 'pass' : reasonLabel}
        </span>
    );
}

const LIVE_REASON_LABEL: Record<string, string> = {
    ok:            'pass',
    wrong_answer:  'wrong answer',
    timeout:       'timeout',
    runtime_error: 'runtime error',
    compile_error: 'compile error',
    sandbox_error: 'sandbox error',
};

function IoBlock({ label, text }: { label: string; text: string }) {
    return (
        <div className="min-w-0">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</p>
            <pre className="themed-scrollbar max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border/60 bg-background/60 p-2 font-mono text-xs leading-relaxed text-foreground/90">
                {text || '(empty)'}
            </pre>
        </div>
    );
}
