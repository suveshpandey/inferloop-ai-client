// Mirrors the backend response shapes. Source of truth lives in
// inferloop-server/src/agents/schemas.ts. Keep in sync if the backend changes.

// ───────────────────────── Agent output primitives ─────────────────────────

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type Category =
    | 'bug'
    | 'smell'
    | 'complexity'
    | 'security'
    | 'performance'
    | 'edge-case';

export type Finding = {
    severity: Severity;
    category: Category;
    title: string;
    description: string;
    line?: number;
    // Optional DSA / CP-oriented complexity tags. Short Big-O strings like "O(n)" /
    // "O(n log n)" — the Analyzer attaches them on findings about runtime or
    // memory. Absent on non-algorithmic findings and on all pre-pivot runs.
    timeComplexity?: string;
    spaceComplexity?: string;
};

export type AnalyzerOutput = {
    findings: Finding[];
    summary: string;
};

// ──────────────────────────────── Critic ───────────────────────────────────

export type CriticDecision = 'keep' | 'drop' | 'modify';

export type ReviewedFinding = {
    decision: CriticDecision;
    original: Finding;
    revised?: Finding;  // present only when decision === 'modify'
    reason: string;
};

export type CriticOutput = {
    reviewedFindings: ReviewedFinding[];
    summary: string;
};

// ────────────────────────────── Improver ───────────────────────────────────

export type ChangeNote = {
    title: string;
    description: string;
    line?: number;
};

export type ImproverOutput = {
    improvedCode: string;
    changeNotes: ChangeNote[];
    summary: string;
};

// ────────────────────────────── Evaluator ──────────────────────────────────

export type Verdict = 'improved' | 'unchanged' | 'regressed';

export type EvaluatorScores = {
    correctness: number;
    bugFixCoverage: number;
    stability: number;
    readability: number;
    overall: number;
    // Optional DSA / CP signals. Populated by the Evaluator when the rewrite touches
    // on algorithmic complexity or edge-case handling — absent otherwise (and
    // on all pre-pivot iterations).
    timeComplexityImproved?: number;
    edgeCaseCoverage?: number;
    // Measured sandbox pass-rate, echoed by the Evaluator. The one "measured,
    // not LLM-judged" score — surfaced distinctly in the UI.
    testPassRate?: number;
};

export type EvaluatorOutput = {
    verdict: Verdict;
    scores: EvaluatorScores;
    rationale: string;
    unaddressedFindings?: Finding[];
};

// ──────────────────────── Full pipeline result ─────────────────────────────

export type ReviewResult = {
    findings: AnalyzerOutput;
    reviewed: CriticOutput;
    improved: ImproverOutput;
    evaluation: EvaluatorOutput;
};

// ─────────────────────────── Test cases / results ──────────────────────────

export type TestSource = 'generated' | 'manual';

// A generated test case as it streams in the loop result (no DB id yet).
export type TestCaseSpec = {
    name: string;
    input: string;
    expectedOutput: string;
    category?: 'sample' | 'edge';
};

// A per-case execution result during the loop (keyed by index into testCases).
export type LiveTestResult = {
    caseIndex: number;
    name: string;
    passed: boolean;
    actualOutput: string;
    stderr: string;
    exitCode: number | null;
    durationMs: number;
    errorReason: string;  // 'ok' | 'wrong_answer' | 'timeout' | 'runtime_error' | 'compile_error' | 'sandbox_error'
};

// ─────────────────────── Iterative loop result ─────────────────────────────

export type TerminationReason =
    | 'all-pass'         // tests reached 100%
    | 'stalled'          // pass-rate stopped improving
    | 'no-findings'      // no tests available and analyzer found nothing
    | 'max-iterations'   // hit the cap
    | 'converged'        // legacy (pre-2.4): evaluator unchanged
    | 'regressed';       // legacy (pre-2.4): evaluator regressed

// The Evaluator no longer runs per iteration — each iteration carries its
// measured pass-rate instead; the single verdict lives on LoopResult.
export type IterationResult = {
    iteration:    number;       // 1-based
    inputCode:    string;       // what was fed in for this iteration
    findings:     AnalyzerOutput;
    reviewed:     CriticOutput;
    improved:     ImproverOutput;
    testResults:  LiveTestResult[];
    testPassRate: number | null;
};

export type LoopResult = {
    iterations:        IterationResult[];
    finalCode:         string;
    terminationReason: TerminationReason;
    testCases:         TestCaseSpec[];
    testPassRate:      number | null;            // best pass-rate across iterations
    finalResults:      LiveTestResult[];         // finalCode's per-case results
    finalEvaluation:   EvaluatorOutput | null;   // single end-of-loop verdict
};

// ──────────────────────────────── Auth ─────────────────────────────────────

export type AuthSession = {
    email: string;
    accessToken: string;
    refreshToken: string;
};

export type RefreshResponse = {
    accessToken: string;
};

export type MeResponse = {
    id: string;
    email: string;
    username: string | null;
    createdAt: string;  // ISO timestamp
};

// ────────────────────── SSE events (review/stream) ─────────────────────────

export type Stage = 'analyzer' | 'critic' | 'improver' | 'evaluator';

// Every per-stage event carries `iteration` (1-based) so the frontend can
// group events under the right iteration card. `loop_start`/`iteration_*`
// /`loop_complete` are loop-level milestones. `done` carries the full loop
// result so reconnecting clients can render the final state without replay.
export type StreamEvent =
    | { type: 'loop_start';                maxIterations: number }
    | { type: 'tests_generated';           count: number; cases: TestCaseSpec[] }
    | { type: 'iteration_start';           iteration: number }
    | { type: 'stage_start';               iteration: number; stage: Stage }
    | { type: 'stage_complete';            iteration: number; stage: 'analyzer';  result: AnalyzerOutput }
    | { type: 'stage_complete';            iteration: number; stage: 'critic';    result: CriticOutput }
    | { type: 'stage_complete';            iteration: number; stage: 'improver';  result: ImproverOutput }
    | { type: 'tests_running';             iteration: number }
    | { type: 'test_case_start';           iteration: number; caseIndex: number; name: string }
    | { type: 'test_case_complete';        iteration: number; result: LiveTestResult }
    | { type: 'iteration_complete';        iteration: number; result: IterationResult }
    | { type: 'final_evaluation_starting' }
    | { type: 'final_evaluation';          result: EvaluatorOutput }
    | { type: 'loop_complete';             result: LoopResult }
    | { type: 'done';                      result: LoopResult; runId: string | null }
    | { type: 'error';                     error: string };

// ─────────────────────────── Run history shapes ───────────────────────────
//
// `RunSummary` is the lightweight projection rendered in the sidebar's
// Recents list. `RunDetail` is the full payload backing the historic detail
// view — every iteration's four agent JSON blobs in order.

export type RunSummary = {
    id:                string;
    title:             string;
    language:          string;
    finalScore:        number | null;
    iterationsRun:     number;
    terminationReason: TerminationReason;
    createdAt:         string;  // ISO timestamp
    // Optional because legacy pre-pivot runs were saved without one.
    problemStatement?: string | null;
};

export type StoredIteration = {
    id:              string;
    iterationIndex:  number;
    inputCode:       string;
    analyzerOutput:  AnalyzerOutput;
    criticOutput:    CriticOutput;
    improverOutput:  ImproverOutput;
    // Null on test-driven (2.4+) runs — the Evaluator runs once at the end now.
    // Populated only on legacy pre-2.4 iterations.
    evaluatorOutput: EvaluatorOutput | null;
    overallScore:    number | null;
    // This iteration's measured pass-rate (0–100); null when tests didn't run.
    testPassRate:    number | null;
    createdAt:       string;
};

// A persisted test case (has a DB id + source). Mirrors the backend TestCase.
export type TestCase = {
    id:             string;
    runId:          string;
    name:           string;
    input:          string;
    expectedOutput: string;
    source:         TestSource;
    timeLimitMs?:   number | null;
    memoryLimitMb?: number | null;
    createdAt:      string;
};

// A persisted execution result row. Mirrors the backend TestResult.
export type TestResult = {
    id:           string;
    testCaseId:   string;
    runId:        string;
    iterationId?: string | null;
    passed:       boolean;
    actualOutput?: string | null;
    stderr?:      string | null;
    exitCode?:    number | null;
    durationMs?:  number | null;
    errorReason?: string | null;
    createdAt:    string;
};

export type RunDetail = {
    id:                string;
    title:             string;
    language:          string;
    code:              string;
    finalCode:         string;
    maxIterations:     number;
    iterationsRun:     number;
    terminationReason: TerminationReason;
    finalScore:        number | null;
    createdAt:         string;
    completedAt:       string;
    iterations:        StoredIteration[];
    // Optional because legacy pre-pivot runs were saved without one.
    problemStatement?: string | null;
    // Phase 2.4+. Empty arrays / null on legacy runs.
    testPassRate?:     number | null;
    finalEvaluation?:  EvaluatorOutput | null;
    testCases:         TestCase[];
    testResults:       TestResult[];
};

// Response from POST /api/runs/:id/execute-tests. Results keyed by testCaseId.
export type ExecutedTestResult = {
    testCaseId:   string;
    name:         string;
    passed:       boolean;
    actualOutput: string;
    stderr:       string;
    exitCode:     number | null;
    durationMs:   number;
    errorReason:  string;
};

export type ExecuteTestsResponse = {
    results:      ExecutedTestResult[];
    testPassRate: number | null;
    ranAt:        string;
};

// SSE events from POST /api/runs/:id/execute-tests. case_start fires right
// before each case runs in the sandbox; case_complete carries the classified
// result; done is the batch summary; error is terminal.
export type ExecuteTestStreamEvent =
    | { type: 'case_start';    caseId: string; name: string }
    | { type: 'case_complete'; caseId: string; result: ExecutedTestResult }
    | { type: 'done';          results: ExecutedTestResult[]; testPassRate: number | null; ranAt: string }
    | { type: 'error';         error: string };


// ───────────────────────── API error envelope ──────────────────────────────

export type ApiError = {
    error: string;
    details?: unknown;
};
