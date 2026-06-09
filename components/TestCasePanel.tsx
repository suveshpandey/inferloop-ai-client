'use client';

// Test-case panel for the history detail view. One flat list of a run's test
// cases (AI-generated + your own, distinguished by a small badge), each row
// showing pass/fail from the latest execution. "Run tests" streams per-case
// progress live; each row also has its own Play button to rerun just that
// case in isolation.

import { useCallback, useMemo, useRef, useState } from 'react';
import { ApiRequestError, api, executeTestsStream } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ChevronDown, Plus, Play, Trash2, Pencil } from 'lucide-react';
import type { TestCase, TestResult } from '@/lib/types';

// Common display shape for a case's latest result, from either the stored
// TestResult (initial load) or a fresh execute-tests response.
type DisplayResult = {
    passed:       boolean;
    actualOutput: string;
    stderr:       string;
    errorReason:  string;
    durationMs:   number | null;
};

const REASON_LABEL: Record<string, string> = {
    ok:            'pass',
    wrong_answer:  'wrong answer',
    timeout:       'timeout',
    runtime_error: 'runtime error',
    compile_error: 'compile error',
    sandbox_error: 'sandbox error',
};

function toDisplay(r: TestResult): DisplayResult {
    return {
        passed:       r.passed,
        actualOutput: r.actualOutput ?? '',
        stderr:       r.stderr ?? '',
        errorReason:  r.errorReason ?? (r.passed ? 'ok' : 'wrong_answer'),
        durationMs:   r.durationMs ?? null,
    };
}

type FormState = { name: string; input: string; expectedOutput: string };
const EMPTY_FORM: FormState = { name: '', input: '', expectedOutput: '' };

// Per-row execution state. `queued` means the user clicked Run but the sandbox
// hasn't reached this case yet (it's compile + earlier cases). `running` means
// the sandbox is actively executing this case right now.
type CellState = 'idle' | 'queued' | 'running';

export function TestCasePanel({
    runId,
    initialCases,
    initialResults,
}: {
    runId: string;
    initialCases: TestCase[];
    initialResults: TestResult[];
}) {
    const [cases, setCases] = useState<TestCase[]>(initialCases);
    const [results, setResults] = useState<Map<string, DisplayResult>>(
        () => new Map(initialResults.map((r) => [r.testCaseId, toDisplay(r)])),
    );
    // Per-case live state keyed by case id. Drives the badge column.
    const [cellState, setCellState] = useState<Map<string, CellState>>(() => new Map());
    // True while ANY execute-tests stream is active. Disables global controls.
    const [streaming, setStreaming] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    // Track the in-flight stream so we can abort if the component unmounts /
    // the user navigates away. (Not user-cancellable yet — the sandbox bills
    // the same either way once it's running.)
    const abortRef = useRef<AbortController | null>(null);

    const passRate = useMemo(() => {
        if (cases.length === 0) return null;
        const scored = cases.filter((c) => results.has(c.id));
        if (scored.length === 0) return null;
        const passed = scored.filter((c) => results.get(c.id)!.passed).length;
        return Math.round((100 * passed) / scored.length);
    }, [cases, results]);

    const runStream = useCallback(async (caseIds?: string[]) => {
        if (streaming) return;
        setStreaming(true);

        const targetIds = caseIds && caseIds.length > 0
            ? caseIds
            : cases.map((c) => c.id);

        // Mark targets as queued so the user sees activity on every row
        // immediately, not just when the sandbox reaches it.
        setCellState((prev) => {
            const next = new Map(prev);
            for (const id of targetIds) next.set(id, 'queued');
            return next;
        });

        const controller = new AbortController();
        abortRef.current = controller;

        let total = 0;
        try {
            await executeTestsStream(runId, {
                caseIds,
                signal: controller.signal,
                onEvent: (ev) => {
                    switch (ev.type) {
                        case 'case_start':
                            setCellState((prev) => {
                                const next = new Map(prev);
                                next.set(ev.caseId, 'running');
                                return next;
                            });
                            break;
                        case 'case_complete': {
                            const r = ev.result;
                            setResults((prev) => {
                                const next = new Map(prev);
                                next.set(r.testCaseId, {
                                    passed:       r.passed,
                                    actualOutput: r.actualOutput,
                                    stderr:       r.stderr,
                                    errorReason:  r.errorReason,
                                    durationMs:   r.durationMs,
                                });
                                return next;
                            });
                            setCellState((prev) => {
                                const next = new Map(prev);
                                next.delete(r.testCaseId);
                                return next;
                            });
                            break;
                        }
                        case 'done':
                            total = ev.results.length;
                            // Clear any lingering queued/running states (e.g.
                            // a compile-error short-circuit would have already
                            // sent case_complete for each — this is defensive).
                            setCellState((prev) => {
                                if (prev.size === 0) return prev;
                                const next = new Map(prev);
                                for (const id of targetIds) next.delete(id);
                                return next;
                            });
                            notifySuccess(
                                `Ran ${total} test${total === 1 ? '' : 's'}`,
                                {
                                    description: ev.testPassRate === null
                                        ? undefined
                                        : `${ev.testPassRate}% passing`,
                                },
                            );
                            break;
                        case 'error':
                            throw new Error(ev.error);
                    }
                },
            });
        } catch (err) {
            if (controller.signal.aborted) return;
            notifyError(err instanceof ApiRequestError ? err.message : (err instanceof Error ? err.message : 'Test run failed'), {
                description: 'The sandbox may be unavailable. Try again in a moment.',
            });
        } finally {
            // Clear any rows still marked queued/running (e.g. after an error
            // mid-stream) so the UI doesn't get stuck.
            setCellState((prev) => {
                if (prev.size === 0) return prev;
                const next = new Map(prev);
                for (const id of targetIds) next.delete(id);
                return next;
            });
            if (abortRef.current === controller) abortRef.current = null;
            setStreaming(false);
        }
    }, [runId, cases, streaming]);

    const runAll = useCallback(() => runStream(undefined), [runStream]);
    const runOne = useCallback((id: string) => runStream([id]), [runStream]);

    const submitForm = useCallback(async () => {
        const name = form.name.trim();
        if (!name || !form.input.trim() || !form.expectedOutput.trim()) {
            notifyError('Every field is required', { description: 'Give the case a name, input, and expected output.' });
            return;
        }
        try {
            if (editingId) {
                const { testCase } = await api.updateTestCase(runId, editingId, form);
                setCases((prev) => prev.map((c) => (c.id === editingId ? testCase : c)));
            } else {
                const { testCase } = await api.createTestCase(runId, form);
                setCases((prev) => [...prev, testCase]);
            }
            setForm(EMPTY_FORM); setAdding(false); setEditingId(null);
        } catch (err) {
            notifyError(err instanceof ApiRequestError ? err.message : 'Could not save the test case');
        }
    }, [form, editingId, runId]);

    const startEdit = useCallback((c: TestCase) => {
        setEditingId(c.id);
        setAdding(true);
        setForm({ name: c.name, input: c.input, expectedOutput: c.expectedOutput });
    }, []);

    const removeCase = useCallback(async (id: string) => {
        setBusyId(id);
        try {
            await api.deleteTestCase(runId, id);
            setCases((prev) => prev.filter((c) => c.id !== id));
            setResults((prev) => { const next = new Map(prev); next.delete(id); return next; });
        } catch (err) {
            notifyError(err instanceof ApiRequestError ? err.message : 'Could not delete the test case');
        } finally {
            setBusyId(null);
        }
    }, [runId]);

    return (
        <section className="mt-8">
            <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-widest text-foreground">Test cases</span>
                <span className="h-px flex-1 bg-border" />
                {passRate !== null && (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {passRate}% passing
                    </span>
                )}
                <Button
                    type="button" variant="outline" size="sm"
                    onClick={runAll} disabled={streaming || cases.length === 0}
                    className="h-7 gap-1.5 font-mono text-[10px] uppercase tracking-widest"
                >
                    {streaming ? <Spinner size="sm" /> : <Play className="h-3 w-3" />}
                    {streaming ? 'Running…' : 'Run tests'}
                </Button>
            </div>

            {cases.length === 0 && !adding && (
                <Card className="gap-0 bg-card/50 px-5 py-4">
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
                        No test cases on this run.
                    </p>
                </Card>
            )}

            <ul className="space-y-2">
                {cases.map((c) => {
                    const r     = results.get(c.id);
                    const cell  = cellState.get(c.id) ?? 'idle';
                    const open  = expandedId === c.id;
                    return (
                        <li
                            key={c.id}
                            className={[
                                'overflow-hidden rounded-md border bg-background/40 transition-colors',
                                cell === 'running' ? 'border-foreground/40 bg-background/60' : 'border-border/60',
                            ].join(' ')}
                        >
                            <div className="flex items-center gap-2 px-3 py-2.5">
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(open ? null : c.id)}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                >
                                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                                    <SourceBadge source={c.source} />
                                    <span className="truncate font-mono text-sm">{c.name}</span>
                                </button>

                                {/* Status column — live state wins; falls back
                                    to the last persisted result; "not run"
                                    otherwise. */}
                                {cell === 'running'
                                    ? <LiveBadge label="running" />
                                    : cell === 'queued'
                                        ? <LiveBadge label="queued" tone="muted" />
                                        : r
                                            ? <ResultBadge result={r} />
                                            : <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">not run</span>
                                }

                                {/* Per-case Run button — reruns ONLY this case
                                    through its own sandbox stream. Disabled
                                    while any stream (this row's or the global
                                    "Run tests") is in flight to avoid sandbox
                                    contention. */}
                                <button
                                    type="button"
                                    onClick={() => runOne(c.id)}
                                    disabled={streaming}
                                    className="text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground/60"
                                    aria-label="Run this test case"
                                    title="Run this test case"
                                >
                                    <Play className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    type="button" onClick={() => startEdit(c)}
                                    className="text-muted-foreground/60 transition-colors hover:text-foreground"
                                    aria-label="Edit test case"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    type="button" onClick={() => removeCase(c.id)} disabled={busyId === c.id}
                                    className="text-muted-foreground/60 transition-colors hover:text-rose-500 disabled:opacity-40"
                                    aria-label="Delete test case"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            {open && (
                                <div className="grid gap-3 border-t border-border/60 bg-background/30 px-3 py-3 sm:grid-cols-2">
                                    <IoBlock label="Input" text={c.input} />
                                    <IoBlock label="Expected" text={c.expectedOutput} />
                                    {r && (
                                        <IoBlock
                                            label="Actual output"
                                            text={r.actualOutput || '(no output)'}
                                            tone={r.passed ? 'ok' : 'bad'}
                                        />
                                    )}
                                    {r && r.stderr && (
                                        <IoBlock label="Stderr" text={r.stderr} tone="bad" />
                                    )}
                                    {r && (
                                        <div className="sm:col-span-2 flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
                                            <span>{REASON_LABEL[r.errorReason] ?? r.errorReason}</span>
                                            {r.durationMs !== null && (
                                                <>
                                                    <span className="text-muted-foreground/30">·</span>
                                                    <span className="tabular-nums">{r.durationMs} ms</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            {adding ? (
                <Card className="mt-2 gap-3 bg-card/50 p-4">
                    <Input
                        placeholder="Case name (e.g. edge: empty input)"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="font-mono text-sm"
                    />
                    <Textarea
                        placeholder="Input (stdin)" rows={3} value={form.input}
                        onChange={(e) => setForm((f) => ({ ...f, input: e.target.value }))}
                        className="font-mono text-sm"
                    />
                    <Textarea
                        placeholder="Expected output (stdout)" rows={3} value={form.expectedOutput}
                        onChange={(e) => setForm((f) => ({ ...f, expectedOutput: e.target.value }))}
                        className="font-mono text-sm"
                    />
                    <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={submitForm} className="font-mono text-[11px] uppercase tracking-widest">
                            {editingId ? 'Save' : 'Add case'}
                        </Button>
                        <Button
                            type="button" size="sm" variant="ghost"
                            onClick={() => { setForm(EMPTY_FORM); setAdding(false); setEditingId(null); }}
                            className="font-mono text-[11px] uppercase tracking-widest"
                        >
                            Cancel
                        </Button>
                    </div>
                </Card>
            ) : (
                <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => setAdding(true)}
                    className="mt-2 gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
                >
                    <Plus className="h-3 w-3" /> Add case
                </Button>
            )}
        </section>
    );
}

function SourceBadge({ source }: { source: TestCase['source'] }) {
    const isAi = source === 'generated';
    return (
        <Badge
            variant="outline"
            className={`h-auto shrink-0 rounded-full px-1.5 py-0 font-mono text-[9px] uppercase tracking-widest ${
                isAi ? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200'
                     : 'border-border/60 bg-background/60 text-muted-foreground'
            }`}
        >
            {isAi ? 'AI' : 'You'}
        </Badge>
    );
}

function ResultBadge({ result }: { result: DisplayResult }) {
    const label = result.passed ? 'pass' : (REASON_LABEL[result.errorReason] ?? 'fail');
    return (
        <Badge
            variant="outline"
            className={`h-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                result.passed ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                              : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200'
            }`}
        >
            {label}
        </Badge>
    );
}

// Used for queued/running states. `running` pulses softly; `queued` is dim.
function LiveBadge({ label, tone = 'live' }: { label: string; tone?: 'live' | 'muted' }) {
    return (
        <span className={[
            'shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest',
            tone === 'live'
                ? 'border-foreground/40 bg-background/60 text-foreground animate-pulse-soft'
                : 'border-border/60 bg-background/40 text-muted-foreground/70',
        ].join(' ')}>
            {label}
        </span>
    );
}

function IoBlock({ label, text, tone }: { label: string; text: string; tone?: 'bad' | 'ok' }) {
    const toneCls =
        tone === 'bad' ? 'border-rose-500/30 bg-rose-500/[0.04] text-rose-700 dark:text-rose-200' :
        tone === 'ok'  ? 'border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-800 dark:text-emerald-200' :
                         'border-border/60 bg-background/60 text-foreground/90';
    return (
        <div className="min-w-0">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</p>
            <pre className={`themed-scrollbar max-h-40 overflow-auto whitespace-pre-wrap rounded border p-2 font-mono text-xs leading-relaxed ${toneCls}`}>
                {text || '(empty)'}
            </pre>
        </div>
    );
}
