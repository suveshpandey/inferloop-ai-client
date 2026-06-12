# InferLoop Client

Frontend for **InferLoop AI** — a five-agent, test-driven *review + rewrite* loop for DSA / competitive-programming submissions. You paste a problem statement + your Python or C++ solution; the UI streams every stage live (test generation → per-iteration agents → per-case sandbox results → final verdict) and saves the run to history. The rewrite you get back is the one that scored highest against the generated cases, not the latest. Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, and Monaco. Talks to the [`inferloop-server`](../inferloop-server) backend over HTTP + Server-Sent Events.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| UI library | React 19 |
| Styling | Tailwind CSS 4 (OKLCH theme tokens) |
| Component primitives | shadcn/ui (Nova preset) |
| Code editor + diff | Monaco (`@monaco-editor/react`, bundled locally) |
| Toasts | sonner |
| Fonts | IBM Plex Sans + Geist Mono (`next/font`) |
| Package manager | pnpm |

---

## Project structure

```
inferloop-client/
├── app/
│   ├── layout.tsx                 # Root layout — fonts, providers (Theme/Auth/Sidebar), Header
│   ├── page.tsx                   # / — marketing landing (redirects authed users to /review)
│   ├── globals.css                # Tailwind + theme CSS variables (light + dark)
│   ├── how-it-works/page.tsx      # Public deep-dive into the 5-agent + sandbox flow
│   ├── login/page.tsx             # Login form
│   ├── signup/page.tsx            # Signup form
│   └── (app)/                     # Authed shell — wraps children with AppSidebar
│       ├── layout.tsx             # [sidebar | main] split
│       ├── review/page.tsx        # Live review — editor + SSE-driven iteration accordions + live test panel
│       ├── history/[id]/page.tsx  # Historic run snapshot — same UI + interactive TestCasePanel
│       └── profile/page.tsx       # Account details, change-password, sign-out
├── components/
│   ├── Header.tsx                 # Brand + theme toggle + user menu (authed shell)
│   ├── Footer.tsx                 # Minimal site footer — landing + /how-it-works share it
│   ├── AppSidebar.tsx             # Quiet sidebar — New review, Recents (with hover-delete), profile strip
│   ├── ThemeToggle.tsx            # Light/dark switch
│   ├── UserMenu.tsx               # Header dropdown — username, email, profile link, sign-out
│   ├── CodeEditor.tsx             # Monaco input editor (theme-aware)
│   ├── DiffViewer.tsx             # Monaco diff (original vs improved) with Keep/Discard
│   ├── ReviewResults.tsx          # Iteration accordions + exported FinalEvaluation summary tile
│   ├── TestCasePanel.tsx          # Interactive test-case list — AI/You badge, per-case pass/fail, Run/Add/Edit/Delete
│   ├── HeroVisual.tsx, Meteors.tsx, AuthAside.tsx, AppTopBar.tsx, SidebarUserStrip.tsx
│   └── ui/                        # shadcn/ui primitives — button, card, input, password-input, ...
├── contexts/
│   ├── AuthContext.tsx            # Session state + token storage, exposes useAuth()
│   ├── ThemeContext.tsx           # light/dark with localStorage key inferloop.theme
│   └── SidebarContext.tsx         # Mobile drawer + recentsVersion bump for sidebar refresh
├── lib/
│   ├── api.ts                     # fetch wrapper with auto-refresh + SSE consumer (reviewStream)
│   ├── languages.ts               # Single source of truth for supported languages (Python, C++) + sandboxReady gate
│   ├── types.ts                   # Mirrors backend schemas (Finding, RunDetail, StreamEvent, TestCase, LiveTestResult, ...)
│   ├── monaco-theme.ts            # Light + dark Monaco themes, language map
│   ├── notify.ts                  # Sonner wrappers — notifyError / notifySuccess / notifyInfo
│   ├── user.ts                    # initialsFromIdentity, formatJoinedDate
│   └── utils.ts                   # cn()
├── components.json                # shadcn/ui config
├── next.config.ts                 # Next.js config
└── .env.local                     # Local env (gitignored)
```

---

## Prerequisites

- Node.js 20+
- pnpm 10+
- The backend (`inferloop-server`) running on `http://localhost:3001`. See its [README](../inferloop-server/README.md).

---

## Setup (first time)

```bash
cd inferloop-client
pnpm install
```

Copy `.env.example` → `.env.local` and adjust if your backend lives somewhere other than `http://localhost:3001`:

```bash
cp .env.example .env.local
```

The single variable is `NEXT_PUBLIC_API_URL` — the `NEXT_PUBLIC_` prefix is required so the value is exposed to browser code (the client makes HTTP + SSE calls directly from the browser).

---

## Run the dev server

```bash
pnpm dev
```

Open `http://localhost:3000`. The backend must also be running.

---

## NPM scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start Next.js in dev mode (Turbopack, hot reload) |
| `pnpm build` | Production build. Type-checks and lints the whole app — fails on any error, so it doubles as the pre-push check. |
| `pnpm start` | Run the production build (run `pnpm build` first). |
| `pnpm lint` | Run ESLint |

---

## How the client talks to the backend

All API calls go through `lib/api.ts`, which:
- Stores tokens in `localStorage` (`inferloop_access_token`, `inferloop_refresh_token`).
- Sends `Authorization: Bearer <access>` on authed routes.
- On `401`, transparently calls `/auth/refresh` once and retries the original request.

| Endpoint | Used for |
|---|---|
| `POST /auth/signup` | Create an account |
| `POST /auth/login` | Get access + refresh tokens |
| `POST /auth/refresh` | Mint a new access token (called automatically on 401) |
| `POST /auth/logout` | Revoke the current refresh token |
| `GET  /auth/me` | Fetch current user (drives `AuthContext`) |
| `POST /auth/change-password` | Profile page → security section |
| `POST /api/review/stream` | Run the test-driven pipeline; receive per-stage + per-case SSE events |
| `GET  /api/runs` | Sidebar Recents (last 30) |
| `GET  /api/runs/:id` | Historic run detail (`/history/[id]`) |
| `DELETE /api/runs/:id` | Hover-delete on a sidebar Recents row |
| `GET  /api/runs/:runId/test-cases` | TestCasePanel — list cases |
| `POST /api/runs/:runId/test-cases` | TestCasePanel — add a manual case |
| `PATCH /api/runs/:runId/test-cases/:id` | TestCasePanel — edit a case (incl. fixing a wrong-expected on a generated one) |
| `DELETE /api/runs/:runId/test-cases/:id` | TestCasePanel — delete a case |
| `POST /api/runs/:runId/execute-tests` | TestCasePanel — re-run all cases against the run's `finalCode` |

### Streaming

`POST /api/review/stream` returns `Content-Type: text/event-stream`. The client reads `response.body` as a `ReadableStream`, parses SSE frames, and dispatches each event into UI state.

Event types (all carry `type` in the JSON payload so they discriminate cleanly):

- `loop_start` — the iterative loop begins.
- `tests_generated` — generation finished; payload carries `count` + the actual `cases[]` so the UI renders them immediately.
- `iteration_start` / `iteration_complete` — bookends per iteration.
- `stage_start` / `stage_complete` — per-agent within an iteration (analyzer / critic / improver only — the Evaluator runs once at the end).
- `tests_running` — sandbox execution started for this iteration.
- `test_case_start` / `test_case_complete` — fired per individual test case during sandbox execution; powers the live `running… → pass / fail` badges in the test list.
- `final_evaluation_starting` / `final_evaluation` — the once-at-end verdict.
- `loop_complete` — full loop result (iterations, finalCode, testCases, testPassRate, finalEvaluation, terminationReason).
- `done` — server has persisted the run; carries `runId` for deep-linking.
- `error` — pipeline failed; stream closes. Payload carries an optional `code: 'transient' | 'persistent'` from the server's classifier (see *Error handling* below).

---

## App shell

Authenticated routes live in the `app/(app)/` route group, which mounts `AppSidebar` to the left and renders `{children}` on the right. The sidebar contains:

1. **New review** — link to `/review`.
2. A dim divider.
3. **Recents** — pulled from `GET /api/runs`. Each row links to `/history/[id]` and reveals a trash icon on hover (calls `DELETE /api/runs/:id`).
4. **Profile strip** — avatar, username, email, links to `/profile`.

The sidebar refetches Recents on four triggers: mount, `recentsVersion` bump from the review page (after `done`), pathname change, and window focus. That guarantees a fresh run appears the moment the loop finishes.

The **review page** also has its own sticky "Pipeline" card that mirrors the live stream as a rail-based timeline: a continuous vertical rail down the left edge, with status dots (`pending` hollow / `running` filled-pulse / `complete` emerald) anchored on the rail and a soft emerald progress overlay that grows downward as stages finish. The nodes are `01 Test generation` → an inline `↻ Loop · N/M` section header → `02 Analyzer` · `03 Critic` · `04 Improver` · `T Testing` (with a live `case X/Y: name` hint anchored under the Testing row while the sandbox is executing) → `05 Final evaluator` as a terminal node with a larger ringed dot. The header carries a `Streaming / Complete / Failed / Ready` pill; the footer is a tone-coded outcome strip (emerald ✓ for all-pass / no-findings, amber ⚠ for regressed, neutral ↻ for stalled / max-iterations / converged, rose ⚠ for errors).

---

## Review page — visual flow

When a review streams in, the main column fills out top-to-bottom:

1. **Generated test cases** card — appears the moment `tests_generated` fires; each case row gets a **live status badge** that ticks `running… → pass / wrong answer / timeout / …` as `test_case_*` events arrive.
2. **Iteration accordions** — the final iteration is expanded by default. Each iteration card shows analyzer findings, critic decisions, the improved-code diff, and a per-iteration `04 · Tests` section with per-case pass/fail badges (click a failed case to see its actual output or stderr).
3. **TestCasePanel** — appears once the run is saved (the page fetches `GET /api/runs/:id` after the `done` event). Fully interactive: Run / Add / Edit / Delete cases, with an `AI` vs `You` badge per row.
4. **Final evaluation tile** — a visually elevated card rendered at the very bottom on both `/review` and `/history/[id]` (verdict + score bars including the measured `Test pass rate ✓` row).

The same structure renders on the history page from `GET /api/runs/:id`.

---

## Public pages

- **`/`** — marketing landing. Top-to-bottom: gradient-accented brand mark, hero tag pill ("AI · test-driven multi-agent review + rewrite · streaming"), tinted three-verb headline (`Reviewed. Tested. Rewritten.`), `by five AI agents, in one streaming loop.` subline, primary CTAs (Get started / Log in), an **open-source row** with two GitHub star pills linking to the [`inferloop-ai-server`](https://github.com/suveshpandey/inferloop-ai-server) and [`inferloop-ai-client`](https://github.com/suveshpandey/inferloop-ai-client) repos, animated `HeroVisual` console on the right, a 5-glyph "AI pipeline" strip, and per-agent cards. Mobile-first: the navbar collapses the "How it works" link and shrinks Login/Signup padding below `sm:` so brand + CTAs + theme toggle all fit on small screens.
- **`/how-it-works`** — deep-dive: 6 numbered steps (submit → generate → loop → terminate → best wins + evaluator → save), 4 design principles, a tech-stack table, and an adaptive CTA (Get started / Start a review).
- Both share the minimal `<Footer />` (brand + © + "How it works" / "Log in" links) and the same gradient `.ai` brand-mark.

---

## Error handling

When the SSE stream emits an `error` event, the review page branches on the server-supplied `code`:

| `code` | Surface |
|---|---|
| `transient` | **Amber** panel with a `CircleDashed` icon, copy *"A backing service is waking up. This usually clears in a few seconds — try again."*, and a **Retry →** button that re-submits the same run without reloading. Triggered by DB cold-start, Vercel Sandbox 5xx/429, transient fetch errors. |
| `persistent` *(or missing)* | **Rose** panel with an `AlertTriangle`, copy *"A stage failed — try again, or report it if it keeps failing."*, and a Retry button. |

The toast also splits — a transient error gets the "waking up" sub-description; a persistent one gets the generic "stream returned an error" line. The retry button reuses the same submit pipeline so the in-flight code / problem statement / iteration cap are preserved verbatim.

---

## Theme

Light + dark themes are driven by CSS variables in `app/globals.css` (OKLCH, shadcn-style). `ThemeContext` applies a `.dark` class on `<html>` and persists the choice under `inferloop.theme`. A pre-paint inline script in `app/layout.tsx` reads the stored preference before React hydrates, preventing FOUC.

Monaco gets its own theme pair in `lib/monaco-theme.ts` (`inferloop-mono` + `inferloop-mono-light`) — re-applied on theme change without remounting the editor.

The light-mode `--muted-foreground` token is tuned to `oklch(0.42 0 0)` so the ~47 callers that layer it with `/60` / `/70` opacity (sidebar section labels, loop hints, status pills, detail strips, ...) still meet contrast on white. Dark mode is untouched.

---

## Deployment

The client is a standard Next.js app — deploy to Vercel or any Next-compatible host. The one environment variable that matters is `NEXT_PUBLIC_API_URL`:

| Environment | Value |
|---|---|
| Local dev (`.env.local`) | `http://localhost:3001` |
| Production (Vercel dashboard → Project Settings → Environment Variables) | The deployed backend's URL, e.g. `https://your-backend.example.com` |

The `NEXT_PUBLIC_` prefix is required so the value is baked into the client bundle at build time. After changing it in the Vercel dashboard, **redeploy** the frontend so the new value is picked up.

Make sure the backend's `CORS_ORIGIN` (comma-separated list) includes the frontend's deployed origin — otherwise the browser will block the SSE stream.

---

## UI primitives

shadcn/ui components live in `components/ui/`. Add more with:

```bash
pnpm dlx shadcn@latest add <component>
```

Currently installed: `button`, `card`, `input`, `password-input`, `label`, `separator`, `badge`, `tabs`, `textarea`, `sonner`, `spinner`.

---

## Roadmap

- ✅ **Phase 0** — Scaffold (Next.js + Tailwind + shadcn/ui)
- ✅ **Phase 1** — Types + API client + auto-refresh
- ✅ **Phase 2** — Auth context + login/signup/profile + change-password
- ✅ **Phase 3** — Review page with live SSE iteration accordions
- ✅ **Phase 4** — Monaco diff viewer (Keep/Discard, theme-aware)
- ✅ **Phase 5** — App shell: header, sidebar, recents, theme toggle
- ✅ **Phase 6** — History persistence wired through (`/history/[id]`, sidebar Recents, hover-delete)
- ✅ **Phase 7** — Test-driven review UI
  - TestCasePanel (live + history, AI/You badged, CRUD + re-run)
  - Live per-case status badges driven by `test_case_*` events
  - Per-iteration `04 · Tests` section + measured `Test pass rate ✓` score row
  - Elevated `FinalEvaluation` summary tile at the bottom of both pages
  - Public `/how-it-works` page + shared `Footer`
- ⏳ **Phase 8** — Multi-file context UI (folder drop + context summary panel)

See `InferLoop_AI_PRD.md` in the repo root for the full product spec.
