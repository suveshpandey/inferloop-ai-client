# InferLoop Client

Frontend for **InferLoop AI** — a multi-agent code-analysis tool. Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, and shadcn/ui. Talks to the [`inferloop-server`](../inferloop-server) backend over HTTP + Server-Sent Events.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| UI library | React 19 |
| Styling | Tailwind CSS 4 |
| Component primitives | shadcn/ui (Nova preset — Lucide icons + Geist font) |
| Package manager | pnpm |

---

## Project structure

```
inferloop-client/
├── app/                       # Next.js App Router pages + layouts
│   ├── layout.tsx             # Root layout (fonts, theme, global CSS)
│   ├── page.tsx               # / — landing / review page
│   └── globals.css            # Tailwind + theme CSS variables
├── components/
│   └── ui/                    # shadcn/ui primitives (button, card, input, ...)
├── lib/
│   └── utils.ts               # cn() helper for Tailwind class merging
├── public/                    # Static assets
├── components.json            # shadcn/ui config
├── next.config.ts             # Next.js config
├── tsconfig.json              # TS config (path alias @/* → root)
├── eslint.config.mjs          # ESLint config
└── .env.local                 # Local env (gitignored)
```

More folders (`lib/api.ts`, `lib/types.ts`, `contexts/`, `app/login/`, `app/signup/`, etc.) will be added as we build features.

---

## Prerequisites

- Node.js 20+
- pnpm 10+
- The backend (`inferloop-server`) running locally on port `3001`. See its [README](../inferloop-server/README.md).

---

## Setup (first time)

```bash
cd inferloop-client
pnpm install
```

Create `.env.local` in this folder:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

The `NEXT_PUBLIC_` prefix is required so the variable is exposed to browser code. Anything without the prefix is server-only.

---

## Run the dev server

```bash
pnpm dev
```

Open `http://localhost:3000`.

The backend must also be running (`pnpm dev` inside `inferloop-server/`) for any API call to succeed.

---

## NPM scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start Next.js in dev mode (Turbopack, hot reload) |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | Run ESLint |

---

## How the client talks to the backend

| Endpoint | Used for |
|---|---|
| `POST /auth/signup` | Create an account |
| `POST /auth/login` | Get access + refresh tokens |
| `POST /auth/refresh` | Mint a new access token when the old one expires (15 min) |
| `POST /auth/logout` | Revoke the current refresh token |
| `GET  /auth/me` | Fetch current user |
| `POST /api/review/stream` | Run the 4-agent pipeline; receive per-stage SSE events |

Auth:
- Access tokens (JWT, 15 min) are sent as `Authorization: Bearer <token>` on every API request.
- Refresh tokens (30 days) are stored client-side and used to mint new access tokens.
- A small wrapper around `fetch` (planned for `lib/api.ts`) will handle 401 → `/auth/refresh` → retry transparently.

Streaming:
- `POST /api/review/stream` returns `Content-Type: text/event-stream`.
- The client reads `response.body` as a `ReadableStream`, parses SSE frames, and dispatches each event into UI state.
- Event types: `stage_start`, `stage_complete` (one of each per agent), `done` (final bundle), `error` (on failure).

---

## UI components

shadcn/ui components live in `components/ui/`. They're copied into the repo (not imported from a package), so they're freely editable. Add more with:

```bash
pnpm dlx shadcn@latest add <component>
```

Currently installed: `button`, `input`, `textarea`, `card`, `badge`, `label`, `tabs`, `separator`.

---

## Theme

Light + dark themes are driven by CSS variables in `app/globals.css` (set up by shadcn init). The project uses a neutral palette (white / grey / dark grey / black) — tune the `--background`, `--foreground`, `--muted`, `--border`, `--card`, etc. variables to adjust.

---

## Roadmap

- ✅ **Phase 0** — Scaffold (Next.js + Tailwind + shadcn/ui)
- ⏳ **Phase 1** — Types + API client (`lib/types.ts`, `lib/api.ts`)
- ⏳ **Phase 2** — Auth context + login/signup pages
- ⏳ **Phase 3** — Review page with live SSE agent cards
- ⏳ **Phase 4** — Diff viewer for improved code (Monaco)
- ⏳ **Phase 5** — Polish (history page, better errors, theme toggle)

See `InferLoop_AI_PRD.md` in the repo root for the full product spec.
