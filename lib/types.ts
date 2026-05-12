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
    | 'style';

export type Finding = {
    severity: Severity;
    category: Category;
    title: string;
    description: string;
    line?: number;
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

// ─────────────────────── Iterative loop result ─────────────────────────────

export type TerminationReason =
    | 'converged'        // evaluator: unchanged
    | 'regressed'        // evaluator: regressed (rolled back)
    | 'no-findings'      // analyzer found nothing
    | 'max-iterations';  // hit the cap

export type IterationResult = ReviewResult & {
    iteration: number;       // 1-based
    inputCode: string;       // what was fed in for this iteration
};

export type LoopResult = {
    iterations:        IterationResult[];
    finalCode:         string;
    terminationReason: TerminationReason;
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
    | { type: 'loop_start';         maxIterations: number }
    | { type: 'iteration_start';    iteration: number }
    | { type: 'stage_start';        iteration: number; stage: Stage }
    | { type: 'stage_complete';     iteration: number; stage: 'analyzer';  result: AnalyzerOutput }
    | { type: 'stage_complete';     iteration: number; stage: 'critic';    result: CriticOutput }
    | { type: 'stage_complete';     iteration: number; stage: 'improver';  result: ImproverOutput }
    | { type: 'stage_complete';     iteration: number; stage: 'evaluator'; result: EvaluatorOutput }
    | { type: 'iteration_complete'; iteration: number; result: IterationResult }
    | { type: 'loop_complete';      result: LoopResult }
    | { type: 'done';               result: LoopResult }
    | { type: 'error';              error: string };

// ───────────────────────── API error envelope ──────────────────────────────

export type ApiError = {
    error: string;
    details?: unknown;
};
