import type {
    AuthSession,
    RefreshResponse,
    MeResponse,
    ReviewResult,
    StreamEvent,
    ApiError,
    RunSummary,
    RunDetail,
    TestCase,
    ExecuteTestsResponse,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

// ───────────────────────────── Token storage ───────────────────────────────

const ACCESS_KEY = 'inferloop_access_token';
const REFRESH_KEY = 'inferloop_refresh_token';

export const tokens = {
    getAccess(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(ACCESS_KEY);
    },
    getRefresh(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(REFRESH_KEY);
    },
    set(access: string, refresh?: string): void {
        localStorage.setItem(ACCESS_KEY, access);
        if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    },
    clear(): void {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
    },
};

// ──────────────────────────── ApiError class ───────────────────────────────

export class ApiRequestError extends Error {
    status: number;
    details: unknown;
    constructor(status: number, message: string, details?: unknown) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

// ─────────────────────── Core fetch with auto-refresh ──────────────────────

// Coalesce concurrent refresh attempts: if 3 requests 401 at once, only one
// /auth/refresh call goes out; the others await the same promise.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    if (refreshInFlight) return refreshInFlight;

    const refreshToken = tokens.getRefresh();
    if (!refreshToken) return null;

    refreshInFlight = (async () => {
        try {
            const res = await fetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            });
            if (!res.ok) {
                tokens.clear();
                return null;
            }
            const data = (await res.json()) as RefreshResponse;
            tokens.set(data.accessToken);
            return data.accessToken;
        } catch {
            tokens.clear();
            return null;
        } finally {
            refreshInFlight = null;
        }
    })();

    return refreshInFlight;
}

type RequestOpts = {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    auth?: boolean;  // attach Authorization header (default: true)
};

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
    const { method = 'GET', body, auth = true } = opts;

    const buildInit = (token: string | null): RequestInit => {
        const headers: Record<string, string> = {};
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (auth && token) headers['Authorization'] = `Bearer ${token}`;
        return {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        };
    };

    let res = await fetch(`${API_URL}${path}`, buildInit(tokens.getAccess()));

    // Try once to refresh + retry on 401 (auth'd routes only)
    if (res.status === 401 && auth) {
        const newAccess = await refreshAccessToken();
        if (newAccess) {
            res = await fetch(`${API_URL}${path}`, buildInit(newAccess));
        }
    }

    if (!res.ok) {
        let payload: ApiError | undefined;
        try { payload = await res.json() as ApiError; } catch { /* non-JSON */ }
        throw new ApiRequestError(
            res.status,
            payload?.error ?? `Request failed with status ${res.status}`,
            payload?.details,
        );
    }

    // 204 No Content (e.g. /auth/logout)
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
}

// ─────────────────────────────── Auth API ──────────────────────────────────

export const api = {
    async signup(input: { email: string; password: string; username?: string }): Promise<AuthSession> {
        const session = await request<AuthSession>('/auth/signup', {
            method: 'POST', body: input, auth: false,
        });
        tokens.set(session.accessToken, session.refreshToken);
        return session;
    },

    async login(input: { email: string; password: string }): Promise<AuthSession> {
        const session = await request<AuthSession>('/auth/login', {
            method: 'POST', body: input, auth: false,
        });
        tokens.set(session.accessToken, session.refreshToken);
        return session;
    },

    async logout(): Promise<void> {
        const refreshToken = tokens.getRefresh();
        if (refreshToken) {
            // Best-effort: revoke on server. Always clear locally.
            try {
                await request<void>('/auth/logout', {
                    method: 'POST', body: { refreshToken }, auth: false,
                });
            } catch { /* ignore — clear anyway */ }
        }
        tokens.clear();
    },

    me(): Promise<MeResponse> {
        return request<MeResponse>('/auth/me');
    },

    changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
        return request<void>('/auth/change-password', { method: 'POST', body: input });
    },

    // Blocking review (kept for completeness — UI will use the streaming version)
    review(input: { code: string; language: string }): Promise<ReviewResult> {
        return request<ReviewResult>('/api/review', { method: 'POST', body: input });
    },

    // History — populated automatically when a streamed review completes.
    listRuns(): Promise<{ runs: RunSummary[] }> {
        return request<{ runs: RunSummary[] }>('/api/runs');
    },

    getRun(id: string): Promise<{ run: RunDetail }> {
        return request<{ run: RunDetail }>(`/api/runs/${id}`);
    },

    deleteRun(id: string): Promise<void> {
        return request<void>(`/api/runs/${id}`, { method: 'DELETE' });
    },

    // ── Test cases (Phase 2.5) ──
    listTestCases(runId: string): Promise<{ testCases: TestCase[] }> {
        return request<{ testCases: TestCase[] }>(`/api/runs/${runId}/test-cases`);
    },

    createTestCase(runId: string, input: { name: string; input: string; expectedOutput: string }): Promise<{ testCase: TestCase }> {
        return request<{ testCase: TestCase }>(`/api/runs/${runId}/test-cases`, { method: 'POST', body: input });
    },

    updateTestCase(runId: string, id: string, input: Partial<{ name: string; input: string; expectedOutput: string }>): Promise<{ testCase: TestCase }> {
        return request<{ testCase: TestCase }>(`/api/runs/${runId}/test-cases/${id}`, { method: 'PATCH', body: input });
    },

    deleteTestCase(runId: string, id: string): Promise<void> {
        return request<void>(`/api/runs/${runId}/test-cases/${id}`, { method: 'DELETE' });
    },

    executeTests(runId: string): Promise<ExecuteTestsResponse> {
        return request<ExecuteTestsResponse>(`/api/runs/${runId}/execute-tests`, { method: 'POST' });
    },

    // Streaming review — see reviewStream() below.
};

// ─────────────────────────── SSE stream consumer ───────────────────────────

type ReviewStreamOpts = {
    onEvent: (event: StreamEvent) => void;
    signal?: AbortSignal;
};

/**
 * POST /api/review/stream and dispatch each parsed SSE event into `onEvent`.
 * Resolves when the stream closes cleanly (server sent `done` or `error`).
 * Rejects on network errors or non-2xx responses.
 */
export async function reviewStream(
    input: {
        code: string;
        language: string;
        // Required after the DSA / CP pivot — every submission is "code solving a
        // specific problem", and every agent reasons against the problem.
        problemStatement: string;
        maxIterations?: number;
    },
    { onEvent, signal }: ReviewStreamOpts,
): Promise<void> {
    const doFetch = async (token: string | null): Promise<Response> => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return fetch(`${API_URL}/api/review/stream`, {
            method: 'POST',
            headers,
            body: JSON.stringify(input),
            signal,
        });
    };

    let res = await doFetch(tokens.getAccess());
    if (res.status === 401) {
        const newAccess = await refreshAccessToken();
        if (newAccess) res = await doFetch(newAccess);
    }

    if (!res.ok || !res.body) {
        let payload: ApiError | undefined;
        try { payload = await res.json() as ApiError; } catch { /* non-JSON */ }
        throw new ApiRequestError(
            res.status,
            payload?.error ?? `Stream failed with status ${res.status}`,
            payload?.details,
        );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line (\n\n).
        let sepIdx: number;
        while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
            const rawFrame = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            const parsed = parseFrame(rawFrame);
            if (parsed) onEvent(parsed);
        }
    }
}

function parseFrame(raw: string): StreamEvent | null {
    let eventName: string | null = null;
    let dataLine: string | null = null;

    for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
            // If multiple data: lines appear in one frame, concatenate with \n
            const chunk = line.slice(5).trim();
            dataLine = dataLine === null ? chunk : `${dataLine}\n${chunk}`;
        }
    }

    if (!eventName || dataLine === null) return null;

    try {
        const data = JSON.parse(dataLine);
        // Backend names match our discriminator values, so the parsed payload
        // already includes `type` — we just trust it.
        return data as StreamEvent;
    } catch {
        return null;
    }
}
