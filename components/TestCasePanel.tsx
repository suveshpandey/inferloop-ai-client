'use client';

// Test-case panel for the history detail view. One flat list of a run's test
// cases (AI-generated + your own, distinguished by a small badge), each row
// showing pass/fail from the latest execution. "Run tests" re-executes the
// final code against every case; manual add / edit / delete curate the set.

import { useCallback, useMemo, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ChevronDown, Plus, Play, Trash2, Pencil } from 'lucide-react';
import type { TestCase, TestResult, ExecutedTestResult } from '@/lib/types';

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
    const [running, setRunning] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const passRate = useMemo(() => {
        if (cases.length === 0) return null;
        const scored = cases.filter((c) => results.has(c.id));
        if (scored.length === 0) return null;
        const passed = scored.filter((c) => results.get(c.id)!.passed).length;
        return Math.round((100 * passed) / scored.length);
    }, [cases, results]);

    const runTests = useCallback(async () => {
        setRunning(true);
        try {
            const res = await api.executeTests(runId);
            setResults(new Map(res.results.map((r: ExecutedTestResult) => [r.testCaseId, {
                passed: r.passed, actualOutput: r.actualOutput, stderr: r.stderr,
                errorReason: r.errorReason, durationMs: r.durationMs,
            }])));
            notifySuccess(`Ran ${res.results.length} test${res.results.length === 1 ? '' : 's'}`, {
                description: res.testPassRate === null ? undefined : `${res.testPassRate}% passing`,
            });
        } catch (err) {
            notifyError(err instanceof ApiRequestError ? err.message : 'Test run failed', {
                description: 'The sandbox may be unavailable. Try again in a moment.',
            });
        } finally {
            setRunning(false);
        }
    }, [runId]);

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
                    onClick={runTests} disabled={running || cases.length === 0}
                    className="h-7 gap-1.5 font-mono text-[10px] uppercase tracking-widest"
                >
                    <Play className="h-3 w-3" /> {running ? 'Running…' : 'Run tests'}
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
                    const r = results.get(c.id);
                    const open = expandedId === c.id;
                    return (
                        <li key={c.id} className="overflow-hidden rounded-md border border-border/60 bg-background/40">
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
                                {r ? <ResultBadge result={r} /> : (
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">not run</span>
                                )}
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
                                    {r && !r.passed && <IoBlock label="Actual" text={r.actualOutput || r.stderr || '(no output)'} tone="bad" />}
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

function IoBlock({ label, text, tone }: { label: string; text: string; tone?: 'bad' }) {
    return (
        <div className="min-w-0">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</p>
            <pre className={`themed-scrollbar max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border/60 bg-background/60 p-2 font-mono text-xs leading-relaxed ${
                tone === 'bad' ? 'text-rose-700 dark:text-rose-200' : 'text-foreground/90'
            }`}>
                {text || '(empty)'}
            </pre>
        </div>
    );
}
