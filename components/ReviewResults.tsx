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
    LoopResult,
    TerminationReason,
} from '@/lib/types';

type Props = {
    iterations: IterationData[];
    language:   string;
    loopResult: LoopResult | null;
    onKeep?:    (iter: IterationData) => void;
    onDiscard?: (iter: IterationData) => void;
};

export function ReviewResults({ iterations, language, loopResult, onKeep, onDiscard }: Props) {
    if (iterations.length === 0) return null;

    const finalIteration = iterations[iterations.length - 1];

    return (
        <div className="space-y-6">
            {/* Loop summary banner — once the run finishes */}
            {loopResult && (
                <LoopSummaryBanner result={loopResult} />
            )}

            {/* Iteration accordions */}
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
                    />
                ))}
            </div>
        </div>
    );
}

// ────────────────────────── Loop summary banner ────────────────────────────

const TERMINATION_TEXT: Record<TerminationReason, { label: string; tone: 'good' | 'neutral' | 'warn' }> = {
    converged:        { label: 'Converged — no further improvements possible',     tone: 'good' },
    'no-findings':    { label: 'Clean code — no findings to fix',                  tone: 'good' },
    regressed:        { label: 'Stopped — last iteration regressed, rolled back',  tone: 'warn' },
    'max-iterations': { label: 'Hit max iterations — further passes may help',     tone: 'neutral' },
};

function LoopSummaryBanner({ result }: { result: LoopResult }) {
    const { label, tone } = TERMINATION_TEXT[result.terminationReason];
    const toneClass =
        tone === 'good'    ? 'border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-200' :
        tone === 'warn'    ? 'border-rose-500/30    bg-rose-500/[0.04]    text-rose-200'    :
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
}: {
    iter: IterationData;
    language: string;
    defaultOpen: boolean;
    onKeep?:    (iter: IterationData) => void;
    onDiscard?: (iter: IterationData) => void;
}) {
    const [open, setOpen] = useState(defaultOpen);

    // Header summary — verdict pill + finding count for at-a-glance.
    const verdict     = iter.evaluator?.verdict;
    const findingsN   = iter.analyzer?.findings.length ?? 0;
    const changesN    = iter.improver?.changeNotes.length ?? 0;
    const overall     = iter.evaluator?.scores.overall;

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
                        {verdict ? (
                            <VerdictPill verdict={verdict} />
                        ) : (
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                running…
                            </span>
                        )}
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
                        {overall !== undefined && (
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                · score {overall}
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
                    <IterationBody iter={iter} language={language} onKeep={onKeep} onDiscard={onDiscard} />
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
}: {
    iter: IterationData;
    language: string;
    onKeep?:    (iter: IterationData) => void;
    onDiscard?: (iter: IterationData) => void;
}) {
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
            {iter.evaluator && <EvaluatorSection data={iter.evaluator} />}
        </div>
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

// ───────────────────────────── 04 · Evaluator ──────────────────────────────

function EvaluatorSection({ data }: { data: EvaluatorOutput }) {
    return (
        <section>
            <SectionMarker
                number="04"
                label="Evaluation"
                badge={<VerdictPill verdict={data.verdict} />}
            />
            {data.rationale && <SectionSummary>{data.rationale}</SectionSummary>}

            <Card className="gap-0 bg-card/50 p-5">
                <ScoreBars scores={data.scores} />
            </Card>

            {data.unaddressedFindings && data.unaddressedFindings.length > 0 && (
                <div className="mt-5 space-y-2.5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Unaddressed findings
                    </p>
                    <Card className="gap-0 bg-card/50 p-2.5">
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

// ────────────────────────────── Pills / tags ───────────────────────────────

const SEVERITY_STYLES: Record<Severity, string> = {
    low:      'border-border/60 bg-background/60 text-muted-foreground',
    medium:   'border-amber-500/30 bg-amber-500/10 text-amber-200',
    high:     'border-orange-500/30 bg-orange-500/10 text-orange-200',
    critical: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
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
    keep:   'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    drop:   'border-border/60 bg-background/60 text-muted-foreground',
    modify: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
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
    improved:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    unchanged: 'border-border/60 bg-background/60 text-muted-foreground',
    regressed: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
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

// ─────────────────────────────── Score bars ────────────────────────────────

const SCORE_LABELS: Array<{ key: keyof EvaluatorScores; label: string }> = [
    { key: 'correctness',     label: 'Correctness'      },
    { key: 'bugFixCoverage',  label: 'Bug fix coverage' },
    { key: 'stability',       label: 'Stability'        },
    { key: 'readability',     label: 'Readability'      },
    { key: 'overall',         label: 'Overall'          },
];

function ScoreBars({ scores }: { scores: EvaluatorScores }) {
    return (
        <div className="space-y-2.5">
            {SCORE_LABELS.map(({ key, label }, idx) => {
                const raw = scores[key];
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
