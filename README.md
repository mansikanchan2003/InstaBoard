# Eko InstaBoard — Instagram Campaign Intelligence Platform

- **Phase 1:** a React + TypeScript frontend converted from the Google Stitch export.
- **Phase 2:** a FastAPI + PostgreSQL backend that serves the same data, which the frontend can use in **API mode**.
- **Data:** all data is the deterministic **demonstration dataset** (Oct 1–31, 2024 vs a Sep 2024 baseline).
- **Honesty:** no Instagram or Meta account is connected, no AI model is called, and nothing is published, sent or authorized.

```
InstaBoard/
├─ design-reference/     # Original Stitch export (unchanged, source of truth for the UI)
├─ frontend/             # React app — runs standalone on bundled demo data (default) or against the API
├─ backend/              # FastAPI + SQLAlchemy + Alembic + PostgreSQL (see backend/README.md)
└─ docker-compose.yml    # optional local PostgreSQL (the backend also has a Docker-free helper)
```

## Two ways to run the frontend

| Mode | Data source | Command (from `frontend/`) |
| --- | --- | --- |
| **Demo** (default) | Typed demo data bundled in the app; no network requests | `npm run dev` |
| **API** | FastAPI at `VITE_API_BASE_URL` (default `http://localhost:8100/api/v1`) backed by PostgreSQL | `npm run dev:api` |

- **Switching modes:** `npm run dev:api` uses Vite mode `api`. Setting `VITE_DATA_SOURCE=api` in `frontend/.env.local` does the same. The banner above every page states which mode is active.
- **API errors are shown, not hidden:**
  - A 404 renders the screen's "not found" state.
  - A `501 not_available` (account sync, disconnect, AI regeneration) and network failures appear in error states and toasts.
  - The app **never** falls back to demo data after an API error.
- **Sign-in differs by mode:**
  - **API mode** requires an account. Every workspace screen waits for `GET /auth/me`, and nothing protected is fetched or shown before it resolves.
  - Unauthenticated visitors go to `/login`, and the app returns them to the page they asked for after sign-in.
  - A session that expires or is revoked mid-use sends you back to `/login` with an explanation.
  - **Demo mode** has no accounts and works exactly as before. `/login` and `/accept-invite` simply redirect to the dashboard.

### Run everything locally (API mode)

**Prerequisites:**
- Node.js 18 or later (tested on 20.17)
- Python 3.12 or later
- PostgreSQL from **one** of: the installed PostgreSQL binaries (used by the helper below), Docker, or your own server

```bash
# 1. Backend (from backend/)
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt        # macOS/Linux: .venv/bin/python
cp .env.example .env                                             # set a local-only password (3 places)
.venv/Scripts/python -m scripts.local_postgres init              # or: docker compose --env-file backend/.env up -d db  (repo root)
.venv/Scripts/alembic upgrade head
.venv/Scripts/python -m scripts.seed_demo_data                   # idempotent
.venv/Scripts/python -m scripts.create_owner --email you@example.com   # first sign-in account; prompts for a password
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8100   # docs: http://localhost:8100/docs

# 2. Frontend (from frontend/, second terminal)
npm install
npm run dev:api                                                  # http://localhost:5173
```

Later sessions only need `python -m scripts.local_postgres start` (or the Docker container), the uvicorn command, and `npm run dev:api`.

Sign in at http://localhost:5173/login with the account you created. Then use Settings → Workspace & Team → **Invite Team Member** to create one-time invitation links for colleagues; no email is sent, so copy the link to them. For stable sessions across backend restarts, set `SECRET_KEY` in `backend/.env` (see `backend/.env.example`).

### Frontend scripts (run from `frontend/`)

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run dev:api` | Dev server in demo / API mode |
| `npm run build` / `npm run build:api` | Type-checks (`tsc -b`) and builds `dist/` for demo / API mode |
| `npm run preview` | Serves the production build locally (client-side routes refresh correctly) |
| `npm run typecheck` | TypeScript only |
| `npm test` | Vitest: route smoke tests, demo-data consistency, formatter, API-client, mutation and auth (api-mode login/expiry/CSRF) tests |
| `npm run export:demo-data` | Regenerates the backend seed file and contract fixture from `src/data` |

Configuration lives in `frontend/.env.example` (`VITE_DATA_SOURCE=demo|api`, `VITE_API_BASE_URL`). Backend setup,
endpoints, the database model and the service-to-endpoint contract map are documented in
[backend/README.md](backend/README.md).

### Tests

```bash
cd frontend && npm test && npm run build
cd backend && .venv/Scripts/python -m pytest -q      # DB tests skip (with a reason) when TEST_DATABASE_URL is unreachable
cd backend && .venv/Scripts/alembic upgrade head && .venv/Scripts/alembic check   # apply migrations, then check model ↔ migration drift
```

## Stack

React 18 · TypeScript 5.6 (strict) · Vite 5 · React Router 6 · Tailwind CSS 3.4 (+ forms, container-queries) ·
Recharts 2 · Material Symbols Outlined (the icon set the export uses — Lucide was not used because it doesn't match) ·
Inter + Plus Jakarta Sans (self-hosted via `@fontsource`). Vitest + Testing Library for tests.

`tailwind.config.ts` reproduces the export's embedded Tailwind config exactly, including its colour tokens, type scale and
the export's custom radius scale. That way the exported class names render the same way they do in the Stitch screens.

## Screen map

| Route | Screen (design-reference folder) |
| --- | --- |
| `/dashboard` | Dashboard — `eko_instaboard_instagram_campaign_intelligence` (dashboard view) |
| `/campaigns` | Campaigns Management — `eko_instaboard_campaigns_management` |
| `/campaigns/:campaignId` | Campaign Detail — `eko_instaboard_campaign_detail_sbi_csp_october` |
| *(global modal)* | New Campaign wizard — `campaignModal` in the dashboard export |
| `/content` | Content Library — `eko_instaboard_content_library` |
| `/content/:contentId` | Reel / Content Analytics — `eko_instaboard_reel_analytics_sbi_csp_mitra` |
| `/audience` | Audience Intelligence — `eko_instaboard_audience_intelligence` |
| `/comments` | Comments Intelligence — `eko_instaboard_comments_intelligence` |
| `/leads` | Leads Pipeline — `view-leads` + lead drawer in the dashboard export (supports `?lead=<id>`) |
| `/ai-insights` | AI Insights Overview — `eko_instaboard_ai_insights_overview` |
| `/ai-insights/:insightId` | AI Insight Detail — `eko_instaboard_ai_insight_detail` |
| `/reports` | Reports Overview — `eko_instaboard_reports_overview` |
| `/reports/:reportId` | Report Detail — `eko_instaboard_report_detail_sbi_csp_campaign` |
| `/accounts` | Instagram Accounts Overview — `eko_instaboard_instagram_accounts_overview` |
| `/accounts/connect` | Connect Instagram Account Flow — `eko_instaboard_connect_instagram_account_flow` |
| `/accounts/:accountId` | Account Detail — `eko_instaboard_account_detail_eko_india_financial_services` |
| `/notifications` | Notifications Inbox — `eko_instaboard_notifications_inbox` |
| `/activity` | Activity Log & Audit Trail — `eko_instaboard_activity_log_audit_trail` |
| `/settings` | Settings & Workspace Configuration — `eko_instaboard_settings_workspace_configuration` (tab kept in `?tab=`) |
| `*` | Not Found page |

The Leads screen exists only as a view inside the dashboard export; every other route has its own dedicated export.

## Project structure (`frontend/src`)

```
app/            Router table, providers, app-wide UI context, preview-state context
components/
  layout/       AppShell, Sidebar (desktop + mobile drawer), TopBar, GlobalSearch, PageHeader/Breadcrumbs, PreviewStateBar
  ui/           Button, Badge (status/health/AI/demo), Card, KpiCard, Controls (tabs, segmented, inputs, toggle, dropdown),
                Overlay (Modal, Drawer), Toast, States (skeleton/empty/error/QueryState), Misc, Icon
  charts/       TrendChart (current vs baseline), BarList
  tables/       TableShell, Th (sortable), Td, Tr (keyboard-accessible rows), Pagination
features/<f>/   Screen sections per feature (dashboard, campaigns, content, audience, comments, leads, ai-insights,
                reports, accounts, notifications, activity, settings)
pages/          One route component per screen (lazy-loaded)
data/           Typed demo datasets (the only place sample records live)
services/       Domain service interfaces (campaignService, contentService, leadService, accountService, …)
lib/            config, API client + demo/api source switch, formatters
hooks/          useQuery (cache + invalidation + preview states), useMutation, useTable (sort/paginate), useDocumentTitle
types/          Domain + feature types
test/           Vitest suites
```

## How data flows

`page → useQuery('<domain>:…', service.fn) → services/<domain>.ts → lib/api/source.ts → (demo data | apiClient)`

- Pages never import demo data directly. Each service method calls `fromSource(() => demoData, '/api/path')`.
  In API mode the same method calls `apiClient.get('/api/path')` on the FastAPI backend, which implements every
  path the services use. A backend contract test asserts that all 143 GET paths return exactly the demo-mode
  payload, so the UI renders identically in both modes.
- Mutations (pause a campaign, change a lead's status, mark notifications read, save settings…) go through
  `mutateSource`. In demo mode they update an in-memory store for the session; in API mode they are
  `POST/PATCH/PUT/DELETE` calls that persist in PostgreSQL (settings and team changes also write audit entries). Query keys are invalidated so every screen refreshes, including the header bell
  and sidebar.
- **Data consistency:** campaigns, content, leads, accounts, audience and account-level KPIs each have one
  canonical source. Other screens derive their totals from those sources instead of retyping them. The Stitch
  screens disagreed with each other in places (for example, a reel showing its whole campaign's totals, or 142.8K
  vs 86.4K followers). Each conflict was settled to one value, and `src/test/data-consistency.test.ts` enforces
  the result: SBI CSP October's four creatives sum exactly to the campaign's 842K views, 421K reach and 186 leads;
  campaign totals stay within the account totals (2.84M views, 6,410 comments, 482 leads); every cross-reference
  resolves.
- Demo data is deterministic. Daily trend series are generated once from a fixed seed, so values never change on
  re-render.

## Interactions implemented (all frontend-only, honest about limits)

- Sidebar and top bar: active states; a mobile navigation drawer; an account switcher; global search across
  campaigns, content and leads (⌘K / Ctrl+K, arrow keys, Enter); date-range presets, with a warning when a preset
  falls outside the demo window; demo **Sync Data** with a "Synced just now" label; the notification bell shows the
  live unread count.
- **Preview states bar** (from the export's "Interactive States" switcher): it forces any page into
  skeleton / empty / API-error states to review those designs, and resets on navigation.
- **Tables:** sorting, filtering, search, pagination; row selection with bulk actions (campaigns, comments); a
  column chooser (content); and grid/list views.
- **New Campaign wizard:** multi-step with validation and a review step, then **Save as Draft / Schedule**. It is
  saved in InstaBoard only and never published to Instagram. Campaigns can also be edited, paused / resumed, and
  duplicated.
- **Leads:** the lead drawer has status updates, copy-a-suggested-reply, and a CSV export. Comments can be
  **converted to leads**, which de-duplicates by handle.
- **Comments:** comment triage — review, flag, archive, mark responded. Replies are copied to the clipboard and
  never posted.
- **AI Insights:** dismiss / review, action-plan checklists, and a simulated "Processing analysis" run.
- **Reports:** a configuration drawer with validation and a live preview; generate (computed from the demo data),
  edit configuration, regenerate. CSV export is a real download built in the browser. "PDF" uses the browser's
  print dialog. XLSX and scheduled delivery explain that they need the backend.
- **Notifications:** read / unread, mark all read, dismiss, a detail modal, and a preferences drawer.
- **Connect Instagram Account:** the full multi-step UI with validation. The Meta authorization step states that
  OAuth isn't available in the prototype, and the walkthrough ends without connecting anything. Disconnect /
  reconnect / sync only affect the local demo list.
- **Settings:** every export tab, with dirty-state tracking, Save / Discard, validation, team invites and role
  changes. Saves write entries to the Activity Log, and the Activity Log has filters, a detail modal and CSV export.
- Accessibility: real buttons and links, labelled inputs, keyboard-operable table rows, Esc/backdrop-closable
  modals and drawers with a focus trap (only the topmost overlay reacts when they stack), a skip link, and
  `aria-current` / `aria-sort`.

## Known gaps / deliberate deviations

- **Remote imagery:** sample images are the export's Google-hosted AI images (`src/data/media.ts`). If a URL
  expires, `ImageWithFallback` shows a branded placeholder. The Eko logo is bundled locally (`public/eko-logo.png`).
- **Canonical values replace some export numbers** where screens contradicted each other, for example "2 Active
  Campaigns" (derived from the data) instead of "6", 10 content items instead of "128", and 7 campaigns instead
  of "of 24".
- **AI insight headline:** the export's title claimed "3.8x in lead conversion", which the dataset doesn't support.
  It is now derived from the data: "Short-Form Hindi Reels Generate 4.1x More Leads Than Carousels".
- **"Live" / "verified Meta API" labels** were reworded to demo labels throughout.
- Only the Oct 2024 window exists in the data; other date presets (and 90-day views) say so instead of inventing
  numbers.
- **Demo mode** mutations reset on reload (in-memory stores). **API mode** persists them in PostgreSQL; to restore
  the original demo values, run `python -m scripts.seed_demo_data --reset`.
- No ESLint config was added; quality gates are `tsc` (strict), Vitest and pytest.

### What is persisted in API mode (Phase 3)

In API mode, these actions are written to PostgreSQL in one transaction (with an Activity Log entry), and the UI
updates only after the server confirms:

- **Campaigns:** create, edit, pause/resume/schedule (with server-side status rules), duplicate as draft.
- **Leads:** status changes and outreach notes.
- **Comments:** convert to lead (atomic and idempotent, so a double click or retry creates no duplicate);
  triage review/flag/archive/responded; bulk triage.
- **AI insights:** review/dismiss, action steps, recommended actions.
- **Reports:** create, edit, duplicate, regenerate, archive.
- **Notifications:** read/unread, dismiss, preferences.
- **Settings and team:** all settings and team changes.

Demo mode applies the same rules (including campaign status transitions) to the in-memory store, so both modes
behave alike. Endpoints and example bodies: [backend/README.md](backend/README.md#write-operations-phase-3).

### Current limitations (API mode)

- **No Meta / Instagram integration:** `POST /accounts/{id}/sync` and `DELETE /accounts/{id}` return `501`, and
  the UI shows that message. The connect flow remains a UI walkthrough with no OAuth.
- **No AI provider:** insights, briefs and narratives are stored demo output. `POST /insights/regenerate` returns `501`.
- **Authentication (Phase 4):** email and password with server-side sessions, plus invitations by link. There is no email delivery, password reset, MFA or SSO yet. See [backend/README.md](backend/README.md#authentication--authorization-phase-4) for the role matrix and remaining risks.
- **Still client-side in both modes:**
  - report figures (computed from campaign/content data fetched via the API);
  - CSV downloads;
  - the global-search index;
  - static UI config: notification trigger labels.
- **No scheduler or email:** report schedules and recipients are saved, but nothing is delivered.

## Recommended next steps

1. **Meta integration:**
   - Facebook Login on the backend, with tokens encrypted at rest and scoped to a workspace.
   - Ingestion jobs for media, insights and comments, run on a scheduler with rate-limit handling.
   - Real rows then replace `is_demo` rows.
2. **Production hardening:**
   - HTTPS deployment, with a shared rate-limit store.
   - Email delivery for invitations and password reset; MFA and SSO.
   - FastAPI/Starlette upgrade, to clear pip-audit advisories.
3. **Server-side reports:** move the report engine to the backend, add PDF/XLSX export and scheduled delivery.
4. **AI provider:** generate insights from persisted metrics, with provenance and human review before anything is
   shown as a recommendation.
5. Swap `useQuery` for TanStack Query for retries, background refresh and server pagination.
