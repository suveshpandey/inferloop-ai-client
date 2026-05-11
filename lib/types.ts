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

export type StreamEvent =
    | { type: 'stage_start';    stage: Stage }
    | { type: 'stage_complete'; stage: 'analyzer';  result: AnalyzerOutput }
    | { type: 'stage_complete'; stage: 'critic';    result: CriticOutput }
    | { type: 'stage_complete'; stage: 'improver';  result: ImproverOutput }
    | { type: 'stage_complete'; stage: 'evaluator'; result: EvaluatorOutput }
    | { type: 'done';  result: ReviewResult }
    | { type: 'error'; error:  string };

// ───────────────────────── API error envelope ──────────────────────────────

export type ApiError = {
    error: string;
    details?: unknown;
};
