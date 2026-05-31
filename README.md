# InferLoop Client

Frontend for **InferLoop AI** — a five-agent, test-driven code-review tool for DSA / competitive-programming submissions. You paste a problem statement + your Python or C++ solution; the UI streams every stage live (test generation → per-iteration agents → per-case sandbox results → final verdict) and saves the run to history. Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, and Monaco. Talks to the [`inferloop-server`](../inferloop-server) backend over HTTP + Server-Sent Events.

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

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

The `NEXT_PUBLIC_` prefix is required so the variable is exposed to browser code.

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
- `error` — pipeline failed; stream closes.

---

## App shell

Authenticated routes live in the `app/(app)/` route group, which mounts `AppSidebar` to the left and renders `{children}` on the right. The sidebar contains:

1. **New review** — link to `/review`.
2. A dim divider.
3. **Recents** — pulled from `GET /api/runs`. Each row links to `/history/[id]` and reveals a trash icon on hover (calls `DELETE /api/runs/:id`).
4. **Profile strip** — avatar, username, email, links to `/profile`.

The sidebar refetches Recents on four triggers: mount, `recentsVersion` bump from the review page (after `done`), pathname change, and window focus. That guarantees a fresh run appears the moment the loop finishes.

The **review page** also has its own sticky "Pipeline" events card that mirrors the live stream: a top "Test generation" tile, four per-iteration stages (Analyzer · Critic · Improver · **Tests**), and a bottom "Final evaluator" tile — all sharing the same glyph-circle visual language with running/complete states.

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

- **`/`** — marketing landing. 5-agent pipeline strip, agent cards, animated HeroVisual.
- **`/how-it-works`** — deep-dive: 6 numbered steps (submit → generate → loop → terminate → best wins + evaluator → save), 4 design principles, a tech-stack table, and an adaptive CTA (Get started / Start a review).
- Both share the minimal `<Footer />` (brand + © + "How it works" / "Log in" links).

---

## Theme

Light + dark themes are driven by CSS variables in `app/globals.css` (OKLCH, shadcn-style). `ThemeContext` applies a `.dark` class on `<html>` and persists the choice under `inferloop.theme`. A pre-paint inline script in `app/layout.tsx` reads the stored preference before React hydrates, preventing FOUC.

Monaco gets its own theme pair in `lib/monaco-theme.ts` (`inferloop-mono` + `inferloop-mono-light`) — re-applied on theme change without remounting the editor.

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
