'use client';

// Detailed review panels for the /review page, grouped by iteration.
//
// Each iteration becomes a collapsible accordion containing the four agent
// sections (Findings, Critic, Improved Code, Evaluation). The LAST iteration
// is expanded by default; prior iterations are collapsed so the user can drop
// in on the final result first and only expand intermediates if curious.

import { useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';
import { DiffViewer } from '@/components/DiffViewer';
import type { IterationData } from '@/app/(app)/review/page';
import type {
    AnalyzerOutput,
    CriticOutput,
    ImproverOutput,
    EvaluatorOutput,
    Finding,
    Severity,
    Category,
    CriticDecision,
    ReviewedFinding,
    Verdict,
    EvaluatorScores,
    LiveTestResult,
    LoopResult,
    TerminationReason,
    TestCaseSpec,
} from '@/lib/types';

type Props = {
    iterations: IterationData[];
    language:   string;
    loopResult: LoopResult | null;
    onKeep?:    (iter: IterationData) => void;
    onDiscard?: (iter: IterationData) => void;
    // Live test-run context for the iteration currently executing tests.
    // Lets the accordion stream per-case pass/fail rows in real time instead
    // of waiting for iteration_complete to flush them all at once.
    liveCases?:        TestCaseSpec[];
    caseLiveStatus?:   Record<number, 'running' | LiveTestResult>;
    testsRunningFor?:  number | null;
};

export function ReviewResults({
    iterations,
    language,
    loopResult,
    onKeep,
    onDiscard,
    liveCases,
    caseLiveStatus,
    testsRunningFor,
}: Props) {
    if (iterations.length === 0) return null;

    const finalIteration = iterations[iterations.length - 1];

    return (
        <div className="space-y-6">
            {/* Loop summary banner — once the run finishes */}
            {loopResult && (
                <LoopSummaryBanner result={loopResult} />
            )}

            {/* Iteration accordions. The final-evaluation section is now
                rendered separately by each page (review + history) AFTER the
                TestCasePanel, so it sits at the very bottom of the page. */}
            <div className="space-y-3">
                {iterations.map((iter) => (
                    <IterationAccordion
                        key={iter.iteration}
                        iter={iter}
                        language={language}
                        // Final iteration expanded by default; others collapsed.
                        defaultOpen={iter.iteration === finalIteration.iteration}
                        onKeep={onKeep}
                        onDiscard={onDiscard}
                        liveCases={
                            testsRunningFor === iter.iteration ? liveCases : undefined
                        }
                        caseLiveStatus={
                            testsRunningFor === iter.iteration ? caseLiveStatus : undefined
                        }
                    />
                ))}
            </div>
        </div>
    );
}

// Exported so the review + history pages can render the final verdict at the
// very bottom (after the TestCasePanel), instead of inside ReviewResults.
// Wrapped in a highlighted container with generous top margin so it reads as
// the page's terminal summary tile, clearly separated from the test panel above.
export function FinalEvaluation({ data }: { data: EvaluatorOutput }) {
    return (
        <Card className="mt-12 gap-0 border-foreground/15 bg-card p-6 shadow-sm ring-1 ring-foreground/5">
            <EvaluatorSection data={data} />
        </Card>
    );
}

// ────────────────────────── Loop summary banner ────────────────────────────

const TERMINATION_TEXT: Record<TerminationReason, { label: string; tone: 'good' | 'neutral' | 'warn' }> = {
    'all-pass':       { label: 'All tests pass — solution is correct',             tone: 'good' },
    stalled:          { label: 'Stopped — pass-rate stopped improving',            tone: 'warn' },
    'no-findings':    { label: 'Clean code — no findings to fix',                  tone: 'good' },
    'max-iterations': { label: 'Hit max iterations — further passes may help',     tone: 'neutral' },
    converged:        { label: 'Converged — no further improvements possible',     tone: 'good' },
    regressed:        { label: 'Stopped — last iteration regressed, rolled back',  tone: 'warn' },
};

function LoopSummaryBanner({ result }: { result: LoopResult }) {
    const { label, tone } = TERMINATION_TEXT[result.terminationReason];
    // Tone palettes pick different shades for light vs dark so the text stays
    // legible against either background. dark: lighter on dark; light: darker
    // on light tint.
    const toneClass =
        tone === 'good'    ? 'border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-200' :
        tone === 'warn'    ? 'border-rose-500/40    bg-rose-500/[0.06]    text-rose-700    dark:text-rose-200'    :
                             'border-border/60      bg-background/40      text-muted-foreground';
    return (
        <div className={`animate-fade-up flex items-center gap-3 rounded-md border px-4 py-3 ${toneClass}`}>
            <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">
                Loop
            </span>
            <span className="font-mono text-xs">{label}</span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest opacity-70">
                {result.iterations.length} iteration{result.iterations.length === 1 ? '' : 's'}
            </span>
        </div>
    );
}

// ─────────────────────────── Iteration accordion ───────────────────────────

function IterationAccordion({
    iter,
    language,
    defaultOpen,
    onKeep,
    onDiscard,
    liveCases,
    caseLiveStatus,
}: {
    iter: IterationData;
    liveCases?:      TestCaseSpec[];
    caseLiveStatus?: Record<number, 'running' | LiveTestResult>;
    language: string;
    defaultOpen: boolean;
    onKeep?:    (iter: IterationData) => void;
    onDiscard?: (iter: IterationData) => void;
}) {
    const [open, setOpen] = useState(defaultOpen);

    // Header summary — measured pass-rate + finding count for at-a-glance.
    const passRate    = iter.testPassRate;
    const findingsN   = iter.analyzer?.findings.length ?? 0;
    const changesN    = iter.improver?.changeNotes.length ?? 0;

    return (
        <div className="animate-fade-up overflow-hidden rounded-lg border border-border bg-card/40">
            {/* Header — clickable to toggle */}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-card/70"
            >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background font-mono text-[10px] text-muted-foreground">
                    {String(iter.iteration).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                        Iteration {iter.iteration}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                        {passRate !== null && passRate !== undefined ? (
                            <PassRatePill rate={passRate} />
                        ) : !iter.improver ? (
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                running…
                            </span>
                        ) : null}
                        {iter.analyzer && (
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                {findingsN} finding{findingsN === 1 ? '' : 's'}
                            </span>
                        )}
                        {iter.improver && (
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                · {changesN} change{changesN === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>
                </div>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        open ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {/* Body — only mounted when open. Cheap to mount/unmount since the
                Monaco DiffEditor inside lazy-loads its own runtime. */}
            {open && (
                <div className="border-t border-border/60 bg-background/30 px-5 py-6">
                    <IterationBody
                        iter={iter}
                        language={language}
                        onKeep={onKeep}
                        onDiscard={onDiscard}
                        liveCases={liveCases}
                        caseLiveStatus={caseLiveStatus}
                    />
                </div>
            )}
        </div>
    );
}

function IterationBody({
    iter,
    language,
    onKeep,
    onDiscard,
    liveCases,
    caseLiveStatus,
}: {
    iter: IterationData;
    language: string;
    onKeep?:    (iter: IterationData) => void;
    onDiscard?: (iter: IterationData) => void;
    liveCases?:      TestCaseSpec[];
    caseLiveStatus?: Record<number, 'running' | LiveTestResult>;
}) {
    // Prefer the authoritative iteration_complete results once they arrive;
    // otherwise stream the in-flight per-case status from the SSE events so the
    // user sees cases tick by below Change Notes in real time.
    const liveActive =
        !iter.testResults &&
        liveCases !== undefined &&
        liveCases.length > 0 &&
        caseLiveStatus !== undefined;

    return (
        <div className="space-y-8">
            {iter.analyzer  && <FindingsSection  data={iter.analyzer}  />}
            {iter.critic    && <CriticSection    data={iter.critic}    />}
            {iter.improver  && (
                <ImproverSection
                    data={iter.improver}
                    originalCode={iter.inputCode}
                    language={language}
                    onKeep={onKeep ? () => onKeep(iter) : undefined}
                    onDiscard={onDiscard ? () => onDiscard(iter) : undefined}
                />
            )}
            {/* Per-iteration test results — measured sandbox pass/fail.
                Streams live during the run; replaced by the authoritative
                results list once iteration_complete arrives. */}
            {iter.testResults && iter.testResults.length > 0 ? (
                <TestResultsSection results={iter.testResults} passRate={iter.testPassRate ?? null} />
            ) : liveActive ? (
                <LiveTestResultsSection
                    cases={liveCases!}
                    liveStatus={caseLiveStatus!}
                />
            ) : null}
        </div>
    );
}

// Streaming companion to TestResultsSection — renders one row per generated
// case, transitioning idle → running → pass/fail as test_case_start /
// test_case_complete events arrive. Rendered only while this iteration is the
// one currently executing tests; swapped out for TestResultsSection once
// iteration_complete delivers the authoritative LiveTestResult[].
function LiveTestResultsSection({
    cases,
    liveStatus,
}: {
    cases:      TestCaseSpec[];
    liveStatus: Record<number, 'running' | LiveTestResult>;
}) {
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    const completed = Object.values(liveStatus).filter(
        (s): s is LiveTestResult => s !== undefined && s !== 'running',
    );
    const passedCount    = completed.filter((r) => r.passed).length;
    const completedCount = completed.length;
    const anyRunning     = Object.values(liveStatus).some((s) => s === 'running');

    return (
        <section>
            <SectionMarker
                number="04"
                label="Tests"
                badge={`${passedCount}/${completedCount}${anyRunning ? ' · running…' : ''}`}
            />
            <Card className="gap-0 bg-card/50 p-2.5">
                <ul className="space-y-1.5">
                    {cases.map((c, i) => {
                        const status = liveStatus[i];
                        const open   = openIdx === i;
                        const result = status && status !== 'running' ? status : null;
                        const failReason = result ? (REASON_LABEL[result.errorReason] ?? result.errorReason) : null;
                        return (
                            <li
                                key={i}
                                className={`overflow-hidden rounded-md border bg-background/40 transition-colors ${
                                    status === 'running'
                                        ? 'border-foreground/40 bg-background/60'
                                        : 'border-border/60'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setOpenIdx(open ? null : i)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                                >
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span className="truncate font-mono text-sm">{c.name}</span>
                                    {result && (
                                        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                            {result.durationMs}ms
                                        </span>
                                    )}
                                    {status === undefined && (
                                        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
                                            queued
                                        </span>
                                    )}
                                    {status === 'running' && (
                                        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-foreground animate-pulse-soft">
                                            running…
                                        </span>
                                    )}
                                    {result && (
                                        <Badge
                                            variant="outline"
                                            className={`h-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                                                result.passed
                                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                                    : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200'
                                            }`}
                                        >
                                            {result.passed ? 'pass' : failReason}
                                        </Badge>
                                    )}
                                </button>
                                {open && result && !result.passed && (
                                    <div className="border-t border-border/60 bg-background/30 px-3 py-2">
                                        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                            {result.errorReason === 'wrong_answer' ? 'Actual output' : 'Stderr / error'}
                                        </p>
                                        <pre className="themed-scrollbar max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border/60 bg-background/60 p-2 font-mono text-xs leading-relaxed text-rose-700 dark:text-rose-200">
                                            {(result.errorReason === 'wrong_answer' ? result.actualOutput : (result.stderr || result.errorReason)) || '(no output)'}
                                        </pre>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </Card>
        </section>
    );
}

// ───────────────────────────── 01 · Findings ───────────────────────────────

function FindingsSection({ data }: { data: AnalyzerOutput }) {
    const n = data.findings.length;
    return (
        <section>
            <SectionMarker
                number="01"
                label="Findings"
                badge={`${n} finding${n === 1 ? '' : 's'}`}
            />
            {data.summary && <SectionSummary>{data.summary}</SectionSummary>}

            {n === 0 ? (
                <EmptyCard>No issues detected.</EmptyCard>
            ) : (
                <Card className="gap-0 bg-card/50 p-2.5">
                    <ul className="space-y-2">
                        {data.findings.map((f, i) => (
                            <li key={i}>
                                <FindingCard finding={f} />
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </section>
    );
}

// ────────────────────────────── 02 · Critic ────────────────────────────────

function CriticSection({ data }: { data: CriticOutput }) {
    const kept = data.reviewedFindings.filter((f) => f.decision !== 'drop').length;
    const total = data.reviewedFindings.length;
    return (
        <section>
            <SectionMarker
                number="02"
                label="Reviewed findings"
                badge={`${kept}/${total} kept`}
            />
            {data.summary && <SectionSummary>{data.summary}</SectionSummary>}

            {total === 0 ? (
                <EmptyCard>Nothing to review.</EmptyCard>
            ) : (
                <Card className="gap-0 bg-card/50 p-2.5">
                    <ul className="space-y-2">
                        {data.reviewedFindings.map((r, i) => (
                            <li key={i}>
                                <ReviewedFindingCard reviewed={r} />
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </section>
    );
}

// ────────────────────────────── 03 · Improver ──────────────────────────────

function ImproverSection({
    data,
    originalCode,
    language,
    onKeep,
    onDiscard,
}: {
    data: ImproverOutput;
    originalCode: string;
    language: string;
    onKeep?:    () => void;
    onDiscard?: () => void;
}) {
    const lineCount = data.improvedCode.split('\n').length;
    return (
        <section>
            <SectionMarker
                number="03"
                label="Improved code"
                badge={`${lineCount} lines`}
            />
            {data.summary && <SectionSummary>{data.summary}</SectionSummary>}

            <DiffViewer
                original={originalCode}
                modified={data.improvedCode}
                language={language}
                onKeep={onKeep}
                onDiscard={onDiscard}
            />

            {data.changeNotes.length > 0 && (
                <div className="mt-5 space-y-2.5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Change notes
                    </p>
                    <ul className="space-y-2">
                        {data.changeNotes.map((n, i) => (
                            <li
                                key={i}
                                className="rounded-md border border-border/60 bg-background/40 p-3"
                            >
                                <div className="flex items-baseline justify-between gap-3">
                                    <p className="font-mono text-sm">{n.title}</p>
                                    {n.line !== undefined && (
                                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                            line {n.line}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                                    {n.description}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

// ─────────────────────── Per-iteration test results ───────────────────────

function TestResultsSection({ results, passRate }: { results: LiveTestResult[]; passRate: number | null }) {
    const [openIdx, setOpenIdx] = useState<number | null>(null);
    const passed = results.filter((r) => r.passed).length;
    return (
        <section>
            <SectionMarker
                number="04"
                label="Tests"
                badge={`${passed}/${results.length}${passRate !== null ? ` · ${passRate}%` : ''}`}
            />
            <Card className="gap-0 bg-card/50 p-2.5">
                <ul className="space-y-1.5">
                    {results.map((r, i) => {
                        const open = openIdx === i;
                        const failReason = REASON_LABEL[r.errorReason] ?? r.errorReason;
                        return (
                            <li key={i} className="overflow-hidden rounded-md border border-border/60 bg-background/40">
                                <button
                                    type="button"
                                    onClick={() => setOpenIdx(open ? null : i)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                                >
                                    <span className="truncate font-mono text-sm">{r.name}</span>
                                    <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                        {r.durationMs}ms
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={`h-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                                            r.passed
                                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                                : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200'
                                        }`}
                                    >
                                        {r.passed ? 'pass' : failReason}
                                    </Badge>
                                </button>
                                {open && !r.passed && (
                                    <div className="border-t border-border/60 bg-background/30 px-3 py-2">
                                        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                            {r.errorReason === 'wrong_answer' ? 'Actual output' : 'Stderr / error'}
                                        </p>
                                        <pre className="themed-scrollbar max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border/60 bg-background/60 p-2 font-mono text-xs leading-relaxed text-rose-700 dark:text-rose-200">
                                            {(r.errorReason === 'wrong_answer' ? r.actualOutput : (r.stderr || r.errorReason)) || '(no output)'}
                                        </pre>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </Card>
        </section>
    );
}

const REASON_LABEL: Record<string, string> = {
    ok:            'pass',
    wrong_answer:  'wrong answer',
    timeout:       'timeout',
    runtime_error: 'runtime error',
    compile_error: 'compile error',
    sandbox_error: 'sandbox error',
};

// ───────────────────────────── 04 · Evaluator ──────────────────────────────

function EvaluatorSection({ data }: { data: EvaluatorOutput }) {
    return (
        <section>
            <SectionMarker
                number="✓"
                label="Final evaluation"
                badge={<VerdictPill verdict={data.verdict} />}
            />
            {data.rationale && <EvaluationRationale text={data.rationale} />}

            <Card className="gap-0 bg-background/50 p-5">
                <ScoreBars scores={data.scores} />
            </Card>

            {data.unaddressedFindings && data.unaddressedFindings.length > 0 && (
                <div className="mt-5 space-y-2.5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Unaddressed findings
                    </p>
                    <Card className="gap-0 bg-background/50 p-2.5">
                        <ul className="space-y-2">
                            {data.unaddressedFindings.map((f, i) => (
                                <li key={i}>
                                    <FindingCard finding={f} />
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            )}
        </section>
    );
}

// ───────────────────────────── Section chrome ──────────────────────────────

function SectionMarker({
    number,
    label,
    badge,
}: {
    number: string;
    label: string;
    badge?: ReactNode;
}) {
    return (
        <div className="mb-3 flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                {number}
            </span>
            <span className="font-mono text-xs uppercase tracking-widest text-foreground">
                {label}
            </span>
            <span className="h-px flex-1 bg-border" />
            {badge && (
                typeof badge === 'string' ? (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {badge}
                    </span>
                ) : badge
            )}
        </div>
    );
}

function SectionSummary({ children }: { children: ReactNode }) {
    return (
        <p className="mb-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {children}
        </p>
    );
}

// ─────────────────────────── Evaluation rationale ────────────────────────

type RationaleBlock =
    | { type: 'paragraph'; text: string }
    | { type: 'ordered';   items: string[] }
    | { type: 'unordered'; items: string[] };

/** Turn a dense evaluator rationale into intro + point-wise blocks. */
function parseEvaluationRationale(text: string): RationaleBlock[] {
    const normalized = text.trim().replace(/\r\n/g, '\n');
    if (!normalized) return [];

    const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) return parseRationaleLines(lines);

    // Single paragraph — split embedded "1. … 2. …" lists common in LLM output.
    return parseRationaleSingleLine(normalized);
}

function parseRationaleLines(lines: string[]): RationaleBlock[] {
    const blocks: RationaleBlock[] = [];
    let paragraphBuf: string[] = [];
    let orderedBuf: string[] = [];
    let unorderedBuf: string[] = [];

    const flushParagraph = () => {
        if (paragraphBuf.length === 0) return;
        blocks.push({ type: 'paragraph', text: paragraphBuf.join(' ') });
        paragraphBuf = [];
    };
    const flushOrdered = () => {
        if (orderedBuf.length === 0) return;
        blocks.push({ type: 'ordered', items: orderedBuf });
        orderedBuf = [];
    };
    const flushUnordered = () => {
        if (unorderedBuf.length === 0) return;
        blocks.push({ type: 'unordered', items: unorderedBuf });
        unorderedBuf = [];
    };
    const flushLists = () => {
        flushOrdered();
        flushUnordered();
    };

    for (const line of lines) {
        const ordered = line.match(/^\d+[.)]\s+(.+)/);
        const unordered = line.match(/^[-*•]\s+(.+)/);

        if (ordered) {
            flushParagraph();
            flushUnordered();
            orderedBuf.push(ordered[1]!);
        } else if (unordered) {
            flushParagraph();
            flushOrdered();
            unorderedBuf.push(unordered[1]!);
        } else {
            flushLists();
            paragraphBuf.push(line);
        }
    }

    flushParagraph();
    flushLists();
    return blocks;
}

function parseRationaleSingleLine(text: string): RationaleBlock[] {
    const markers = [...text.matchAll(/\d+\.\s+/g)];
    if (markers.length < 2) return [{ type: 'paragraph', text }];

    const blocks: RationaleBlock[] = [];
    const firstIdx = markers[0]!.index!;
    if (firstIdx > 0) {
        const intro = text.slice(0, firstIdx).trim().replace(/[:;]\s*$/, '');
        if (intro) blocks.push({ type: 'paragraph', text: intro });
    }

    const items: string[] = [];
    for (let i = 0; i < markers.length; i++) {
        const start = markers[i]!.index! + markers[i]![0].length;
        const end = i + 1 < markers.length ? markers[i + 1]!.index! : text.length;
        const item = text.slice(start, end).trim();
        if (item) items.push(item);
    }
    if (items.length > 0) blocks.push({ type: 'ordered', items });
    return blocks.length > 0 ? blocks : [{ type: 'paragraph', text }];
}

/** Light inline formatting: **bold** and $math$ segments. */
function formatInline(text: string): ReactNode {
    const parts = text.split(/(\*\*[^*]+\*\*|\$[^$]+\$)/g).filter(Boolean);
    if (parts.length === 1) return text;

    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={i} className="font-medium text-foreground/90">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        if (part.startsWith('$') && part.endsWith('$')) {
            return (
                <span key={i} className="font-mono text-[0.92em] text-foreground/85">
                    {part.slice(1, -1)}
                </span>
            );
        }
        return part;
    });
}

function EvaluationRationale({ text }: { text: string }) {
    const blocks = parseEvaluationRationale(text);
    if (blocks.length === 0) return null;

    return (
        <Card className="mb-5 w-full gap-0 bg-background/50 p-5">
            <div className="space-y-4">
            {blocks.map((block, i) => {
                if (block.type === 'paragraph') {
                    return (
                        <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                            {formatInline(block.text)}
                        </p>
                    );
                }
                if (block.type === 'ordered') {
                    return (
                        <ol key={i} className="space-y-3">
                            {block.items.map((item, j) => (
                                <li key={j} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80 font-mono text-[10px] tabular-nums text-muted-foreground/80">
                                        {j + 1}
                                    </span>
                                    <span className="min-w-0 flex-1">{formatInline(item)}</span>
                                </li>
                            ))}
                        </ol>
                    );
                }
                return (
                    <ul key={i} className="space-y-2 pl-1">
                        {block.items.map((item, j) => (
                            <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                                <span className="min-w-0 flex-1">{formatInline(item)}</span>
                            </li>
                        ))}
                    </ul>
                );
            })}
            </div>
        </Card>
    );
}

function EmptyCard({ children }: { children: ReactNode }) {
    return (
        <Card className="gap-0 bg-card/50 px-5 py-4">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
                {children}
            </p>
        </Card>
    );
}

// ─────────────────────────── Finding card variants ─────────────────────────

function FindingCard({ finding }: { finding: Finding }) {
    return (
        <div className="rounded-md border border-border/60 bg-background/40 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <SeverityPill severity={finding.severity} />
                <CategoryTag category={finding.category} />
                <ComplexityPills
                    time={finding.timeComplexity}
                    space={finding.spaceComplexity}
                />
                {finding.line !== undefined && (
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                        line {finding.line}
                    </span>
                )}
            </div>
            <p className="font-mono text-sm">{finding.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {finding.description}
            </p>
        </div>
    );
}

function ReviewedFindingCard({ reviewed }: { reviewed: ReviewedFinding }) {
    const displayed = reviewed.revised ?? reviewed.original;
    return (
        <div className="rounded-md border border-border/60 bg-background/40 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <DecisionPill decision={reviewed.decision} />
                <SeverityPill severity={displayed.severity} />
                <CategoryTag category={displayed.category} />
                <ComplexityPills
                    time={displayed.timeComplexity}
                    space={displayed.spaceComplexity}
                />
                {displayed.line !== undefined && (
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                        line {displayed.line}
                    </span>
                )}
            </div>
            <p className="font-mono text-sm">{displayed.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {displayed.description}
            </p>
            <p className="mt-3 border-t border-border/60 pt-2 font-mono text-xs">
                <span className="uppercase tracking-widest text-muted-foreground/60">Reason · </span>
                <span className="text-foreground/80">{reviewed.reason}</span>
            </p>
        </div>
    );
}

// Renders one or two small Big-O badges (T: O(...), S: O(...)) when the
// Analyzer attached complexity tags to a finding. Both props are optional —
// non-algorithmic findings and legacy pre-pivot data simply don't render
// anything. Compact muted styling so the row stays scannable.
function ComplexityPills({ time, space }: { time?: string; space?: string }) {
    if (!time && !space) return null;
    return (
        <>
            {time && (
                <Badge
                    variant="outline"
                    className="h-auto rounded-full border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[10px] tracking-tight text-muted-foreground"
                >
                    T: {time}
                </Badge>
            )}
            {space && (
                <Badge
                    variant="outline"
                    className="h-auto rounded-full border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[10px] tracking-tight text-muted-foreground"
                >
                    S: {space}
                </Badge>
            )}
        </>
    );
}

// ────────────────────────────── Pills / tags ───────────────────────────────

// Each pill gets a darker text shade for light mode and a lighter one for
// dark mode so it stays legible on either surface. Border alpha bumped from
// /30 to /40 so the outline still reads against a light background.
const SEVERITY_STYLES: Record<Severity, string> = {
    low:      'border-border/60     bg-background/60   text-muted-foreground',
    medium:   'border-amber-500/40  bg-amber-500/10    text-amber-700  dark:text-amber-200',
    high:     'border-orange-500/40 bg-orange-500/10   text-orange-700 dark:text-orange-200',
    critical: 'border-rose-500/40   bg-rose-500/10     text-rose-700   dark:text-rose-200',
};

function SeverityPill({ severity }: { severity: Severity }) {
    return (
        <Badge
            variant="outline"
            className={`h-auto rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${SEVERITY_STYLES[severity]}`}
        >
            {severity}
        </Badge>
    );
}

function CategoryTag({ category }: { category: Category }) {
    return (
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            {category}
        </span>
    );
}

const DECISION_STYLES: Record<CriticDecision, string> = {
    keep:   'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    drop:   'border-border/60      bg-background/60  text-muted-foreground',
    modify: 'border-amber-500/40   bg-amber-500/10   text-amber-700   dark:text-amber-200',
};

function DecisionPill({ decision }: { decision: CriticDecision }) {
    return (
        <Badge
            variant="outline"
            className={`h-auto rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${DECISION_STYLES[decision]}`}
        >
            {decision}
        </Badge>
    );
}

const VERDICT_STYLES: Record<Verdict, string> = {
    improved:  'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    unchanged: 'border-border/60      bg-background/60  text-muted-foreground',
    regressed: 'border-rose-500/40    bg-rose-500/10    text-rose-700    dark:text-rose-200',
};

function VerdictPill({ verdict }: { verdict: Verdict }) {
    return (
        <Badge
            variant="outline"
            className={`h-auto rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${VERDICT_STYLES[verdict]}`}
        >
            {verdict}
        </Badge>
    );
}

// Measured sandbox pass-rate, shown per iteration. Green at 100%, rose at 0%,
// amber in between — the one "measured, not LLM-judged" signal.
function PassRatePill({ rate }: { rate: number }) {
    const style =
        rate >= 100 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' :
        rate <= 0   ? 'border-rose-500/40    bg-rose-500/10    text-rose-700    dark:text-rose-200'    :
                      'border-amber-500/40   bg-amber-500/10   text-amber-700   dark:text-amber-200';
    return (
        <Badge
            variant="outline"
            className={`h-auto rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${style}`}
        >
            tests {rate}%
        </Badge>
    );
}

// ─────────────────────────────── Score bars ────────────────────────────────

// Required scores render always; DSA / CP-specific optional scores (timeComplexityImproved,
// edgeCaseCoverage) render only when the Evaluator populated them. Order
// matters: optional scores sit between the algorithmic dimensions and the
// final "Overall" bar so the visual hierarchy stays consistent.
type ScoreRow = { key: keyof EvaluatorScores; label: string };
const REQUIRED_SCORE_ROWS: ScoreRow[] = [
    { key: 'correctness',    label: 'Correctness'      },
    { key: 'bugFixCoverage', label: 'Bug fix coverage' },
    { key: 'stability',      label: 'Stability'        },
    { key: 'readability',    label: 'Readability'      },
];
const OPTIONAL_SCORE_ROWS: ScoreRow[] = [
    { key: 'testPassRate',           label: 'Test pass rate ✓' },
    { key: 'timeComplexityImproved', label: 'Time complexity ↑' },
    { key: 'edgeCaseCoverage',       label: 'Edge case coverage' },
];

function ScoreBars({ scores }: { scores: EvaluatorScores }) {
    const rows: ScoreRow[] = [
        ...REQUIRED_SCORE_ROWS,
        ...OPTIONAL_SCORE_ROWS.filter((r) => scores[r.key] !== undefined),
        { key: 'overall', label: 'Overall' },
    ];
    return (
        <div className="space-y-2.5">
            {rows.map(({ key, label }, idx) => {
                const raw = scores[key] ?? 0;
                const clamped = Math.max(0, Math.min(100, raw));
                const isOverall = key === 'overall';
                return (
                    <div
                        key={key}
                        className={[
                            'flex items-center gap-3',
                            isOverall && idx > 0 && 'mt-1 border-t border-border/60 pt-3',
                        ].filter(Boolean).join(' ')}
                    >
                        <span
                            className={`w-32 shrink-0 font-mono text-[10px] uppercase tracking-widest ${
                                isOverall ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                        >
                            {label}
                        </span>
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                            <div
                                className={`h-full transition-all duration-500 ${
                                    isOverall ? 'bg-foreground' : 'bg-foreground/50'
                                }`}
                                style={{ width: `${clamped}%` }}
                            />
                        </div>
                        <span
                            className={`w-10 text-right font-mono tabular-nums ${
                                isOverall ? 'text-sm text-foreground' : 'text-xs text-muted-foreground'
                            }`}
                        >
                            {raw}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
