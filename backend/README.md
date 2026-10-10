# InstaBoard backend (Phase 2)

FastAPI + PostgreSQL backend for the existing InstaBoard frontend.

- It serves the frontend's **demonstration dataset**, imported into PostgreSQL. Every seeded row has `is_demo = true`; none of it is live Instagram data.
- There is **no Meta/Instagram integration, no AI provider and no authentication** in this phase.
- It is a **local development service only**: do not expose it publicly (see [Security boundaries](#security-boundaries)).

## Stack

The packages are pinned in `requirements.txt` and `requirements-dev.txt`:

- Python 3.12
- FastAPI 0.115 and Pydantic 2.10 (with pydantic-settings)
- SQLAlchemy 2.0 and Alembic 1.14
- psycopg 3.2
- Uvicorn
- pytest 8 and httpx

## Layout

```
backend/
  app/
    main.py              app factory: CORS, error handlers, /health, /ready, /api/v1 router
    core/                config (env vars via pydantic-settings), database engine/session, structured errors
    models/              SQLAlchemy models (31 tables) — base/enums + account, campaign, content, engagement, intelligence, workspace
    schemas/             Pydantic response + request models (camelCase JSON matching frontend/src/types)
    services/            business logic: queries, aggregations, writes, audit recording
    api/routes/          thin route modules (validation + status codes only)
    seed/                demo_data.json (generated from the frontend) + idempotent loader
  migrations/            Alembic environment + versions (initial schema)
  scripts/               seed_demo_data.py, local_postgres.py (Docker-free dev cluster), docker-init/
  tests/                 pytest suite (+ fixtures/contract_expected.json generated from the frontend)
```

## Prerequisites

- Python 3.12 or later.
- PostgreSQL 15 or later, from **one** of these sources:
  - **The local helper.** It uses the PostgreSQL binaries already installed on your machine and runs a private cluster in `backend/.pgdata` on port 5544. It never touches another PostgreSQL service.
  - **Docker:** `docker compose --env-file backend/.env up -d db` from the repository root. This uses the same port, has a persistent volume and a health check, and creates the test database automatically.
  - **Any PostgreSQL** you control. Point `DATABASE_URL` and `TEST_DATABASE_URL` at it.
- The local helper and the Docker database both listen on `127.0.0.1:5544`, so run **only one at a time**. Stop the
  helper with `python -m scripts.local_postgres stop` before `docker compose ... up -d db`. They use separate data
  directories, so run `alembic upgrade head` and the seed once for each.
- The backend's default port is **8100**, chosen so it doesn't clash with other local services that commonly use 8000.

## Setup

All commands run from `backend/` (PowerShell users: use `.venv\Scripts\python`).

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt     # macOS/Linux: .venv/bin/python
cp .env.example .env                                          # then set a local-only password in all three places
```

Database (choose one):

```bash
.venv/Scripts/python -m scripts.local_postgres init      # first time: creates cluster + instaboard + instaboard_test
.venv/Scripts/python -m scripts.local_postgres start     # later sessions (also: status | stop | create-dbs)
# or, from the repo root:  docker compose --env-file backend/.env up -d db
```

Migrate and seed:

```bash
.venv/Scripts/alembic upgrade head                       # create / update the schema (never auto-created at startup)
.venv/Scripts/python -m scripts.seed_demo_data           # import demo data; safe to re-run (inserts missing rows only)
.venv/Scripts/python -m scripts.seed_demo_data --reset   # restore demo rows to their original values
```

Run:

```bash
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8100
```

- API: `http://localhost:8100/api/v1`
- OpenAPI docs: **http://localhost:8100/docs** (raw schema at `/openapi.json`; turn both off with `ENABLE_DOCS=false`)
- Liveness: `GET /health`
- Readiness: `GET /ready` returns `503` when the database is unreachable

### Environment variables (`.env.example`)

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | `development` \| `test` \| `production` |
| `DATABASE_URL` | **Required.** `postgresql+psycopg://user:password@host:port/instaboard`. There is no built-in default. |
| `TEST_DATABASE_URL` | Database the test suite migrates and wipes. Use a separate database. |
| `CORS_ORIGINS` | Comma-separated browser origins, e.g. `http://localhost:5173`. `*` is rejected because credentials are enabled. |
| `ENABLE_DOCS` | Exposes `/docs` and `/openapi.json`. |
| `LOCAL_PG_PORT`, `LOCAL_PG_USER`, `LOCAL_PG_PASSWORD` | Used by the local helper cluster and Docker Compose. |

### Migrations

```bash
.venv/Scripts/alembic upgrade head          # apply
.venv/Scripts/alembic check                 # fails if models and migrations have drifted
.venv/Scripts/alembic revision --autogenerate -m "describe change"   # after changing models; review the file
.venv/Scripts/alembic downgrade -1
```

### Refreshing the demo dataset

The seed file and the contract fixture are **generated from the frontend's TypeScript demo data**, so records are never re-typed by hand. Run this from `frontend/`:

```bash
npm run export:demo-data     # writes backend/app/seed/demo_data.json and backend/tests/fixtures/contract_expected.json
```

## Tests

```bash
.venv/Scripts/python -m pytest -q
```

- **Without PostgreSQL:** the configuration, health, CORS, error-format and validation tests still run. The database tests are reported as **skipped**, with the reason; they are never silently counted as passed.
- **With `TEST_DATABASE_URL` reachable:**
  - The suite rebuilds the schema with Alembic, seeds it, and runs each test in a rolled-back transaction.
  - It covers the contract (API output equals the frontend's demo payloads for all 143 GET paths), list and detail endpoints, filters, pagination, 404s, an empty database, aggregation consistency, writes, seed idempotency, migration downgrade/upgrade and drift.

## Database model

- **Normalization:** columns that are filtered, sorted, aggregated or joined are relational, with foreign keys, CHECK constraints (enums, ranges, date order, sums) and indexes.
- **JSONB:** used only for display documents with no relational meaning that are always read whole, e.g. insight evidence layouts, telemetry tiles and notification badge styling.
- **Timestamps:** stored as `timestamptz` (UTC) and serialized back in the frontend's IST formats.

| Area | Tables | Notes |
| --- | --- | --- |
| Workspace | `workspaces`, `team_members`, `workspace_settings`, `reference_documents` | one `is_session_user` per workspace (stand-in for auth); settings sections validated by Pydantic |
| Accounts | `instagram_accounts`, `account_telemetry`, `sync_logs` | one primary account per workspace (partial unique index); **no token columns** |
| Account analytics | `account_reporting_periods`, `account_kpis`, `account_daily_metrics`, `audience_snapshots`, `audience_breakdowns` | period aggregates (the dataset holds a sample of leads/comments, but these are totals) |
| Campaigns | `campaigns`, `campaign_metrics` (current/baseline), `campaign_detail_extras`, `campaign_lead_funnel_stages`, `campaign_lead_channels` | account FK `RESTRICT` |
| Content | `content_items`, `content_analytics` | campaign FK `SET NULL` (organic content allowed) |
| Engagement | `leads` (unique handle), `comments`, `comment_period_summaries`, `comment_sentiment_daily` | comment → lead `SET NULL`; sentiment totals CHECK-sum to total |
| Intelligence | `insights`, `recommended_actions`, `reports`, `report_campaigns`, `report_content_items`, `notifications`, `activity_actors`, `activity_events` | reports store configuration only; figures are computed from campaign data |

## Frontend contract map

The frontend `src/services/*.ts` modules call these paths (prefix `/api/v1`) when `VITE_DATA_SOURCE=api`.

| Frontend service | Method + path | Response |
| --- | --- | --- |
| `workspaceService.get / team / currentUser` | `GET /workspace`, `GET /workspace/members`, `GET /me` | `Workspace`, `TeamMember[]`, `TeamMember` |
| `workspaceService.inviteMember / updateMemberAccess / removeMember` | `POST /workspace/members`, `PATCH /workspace/members/{id}`, `DELETE /workspace/members/{id}` | `TeamMember`, `TeamMember`, `{id}` (409 for owner/duplicate) |
| `accountService.list / get` | `GET /accounts` (`?status=`), `GET /accounts/{id}` | `InstagramAccount[]`, `InstagramAccount` |
| `accountService.overview / trends` | `GET /accounts/{id}/overview`, `GET /accounts/{id}/trends` | `AccountOverview`, `Record<TrendMetric, TrendPoint[]>` |
| `accountService.requestSync / disconnect` | `POST /accounts/{id}/sync`, `DELETE /accounts/{id}` | **501 `not_available`** (needs Meta integration) |
| `accountDetailService.*` | `GET /accounts/summary`, `/meta/scopes`, `/accounts/{id}/telemetry`, `/accounts/sync-logs`, `/accounts/{id}/sync-logs` (`?limit&offset`), `/accounts/connect/reference` | summary/policy docs, `ScopeDefinition[]`, `AccountTelemetry`, `SyncLogEntry[]` (newest first) |
| `campaignService.list / get / detail` | `GET /campaigns` (`?status&objective&accountId&q`), `GET /campaigns/{id}`, `GET /campaigns/{id}/detail` | `Campaign[]`, `Campaign`, `CampaignDetailExtras \| null` |
| `campaignService.create / update / setStatus` | `POST /campaigns`, `PATCH /campaigns/{id}` | `Campaign` (saved in InstaBoard only — never published) |
| `contentService.list / listByCampaign / get` | `GET /content` (`?campaignId&type&q`), `GET /campaigns/{id}/content`, `GET /content/{id}` | `ContentItem[]`, `ContentItem` |
| `contentAnalyticsService.get` | `GET /content/{id}/analytics` | `ContentAnalytics \| null` |
| `leadService.list / listByCampaign / summary / campaignFunnel` | `GET /leads` (`?status&campaignId&q`), `GET /campaigns/{id}/leads`, `GET /leads/summary`, `GET /campaigns/{id}/leads/funnel` | `Lead[]`, `LeadPipelineSummary`, `{funnel, channels} \| null` |
| `leadService.updateStatus / createFromComment` | `PATCH /leads/{id}`, `POST /leads` | `Lead` (POST returns the existing lead, 200, for a known handle) |
| `audienceService.summary / intelligence` | `GET /audience/summary`, `GET /audience/intelligence` | `AudienceSummary`, `AudienceIntelligence` |
| `commentsService.summary / sentimentTrend / list / get` | `GET /comments/summary`, `/comments/sentiment-trend`, `/comments` (`?status&sentiment&intent&contentId&campaignId`), `/comments/{id}` | `CommentSummary`, `SentimentTrendPoint[]`, `CommentListResult`, `InstagramComment` |
| `commentsService.update / bulkSetStatus` | `PATCH /comments/{id}`, `POST /comments/bulk` | `InstagramComment`, `{updated}` (no reply is posted to Instagram) |
| `insightsService.overview / list / get / actions` | `GET /insights/overview`, `/insights` (`?category&priority&status`), `/insights/{id}`, `/insights/actions` | stored demo output |
| `insightsService.setStatus / toggleStep / setActionStatus / markAllActionsReviewed` | `PATCH /insights/{id}`, `POST /insights/{id}/steps/{stepId}/toggle`, `PATCH /insights/actions/{id}`, `POST /insights/actions/review-all` | `Insight`, `RecommendedAction`, `{updated}` |
| `insightsService.regenerate` | `POST /insights/regenerate` | **501 `not_available`** (no AI provider) |
| `dashboardService.executiveBrief` | `GET /dashboard/executive-brief` | `ExecutiveBrief` |
| `reportService.list / get` (figures computed client-side) | `GET /reports` (`?status&type`), `GET /reports/{id}`, `GET /reports/reference` | `Report[]`, `Report`, `{boostSpendInr, cplBenchmarkInr}` |
| `reportService.create / update / regenerate / duplicate / setArchived` | `POST /reports`, `PUT /reports/{id}`, `POST /reports/{id}/regenerate`, `POST /reports/{id}/duplicate`, `PATCH /reports/{id}` | `Report` (recipients saved only; nothing is emailed) |
| `notificationService.*` | `GET /notifications` (`?unread&category`), `GET /notifications/unread-count`, `PATCH /notifications/{id}`, `POST /notifications/mark-all-read`, `DELETE /notifications/{id}`, `GET/PUT /notifications/preferences` | `NotificationItem[]`, `number`, … |
| `activityService.list / actors / summary` | `GET /activity` (`?category&outcome&actorId&limit&offset`), `/activity/actors`, `/activity/summary` | `ActivityEntry[]`, `ActivityActor[]`, `ActivitySummary` |
| `settingsService.get / save / environment / session` | `GET /settings`, `PUT /settings`, `GET /settings/environment`, `GET /me/session` | `WorkspaceSettings` (save records an audit entry) |
| *(new, reference only)* | `GET /settings/notification-triggers` | trigger definitions (the frontend still bundles these as static UI config) |

**Errors** use one envelope everywhere: `{"error": {"code", "message", "details"}}`.

| Status | Code |
| --- | --- |
| 404 | `not_found` |
| 422 | `validation_error`, with field locations |
| 409 | `conflict` |
| 501 | `not_available` |
| 503 | `database_unavailable` |
| 500 | `internal_error`, with no internals exposed |

## Security boundaries

- **No authentication.** Every request acts as the seeded demo session user. The routers and services are structured so a `current_principal` dependency and role checks can be added in `app/api/deps.py` and `services/common.current_workspace`.
- **Never deploy as-is.**
  - Bind to `127.0.0.1` (the default in the commands above).
  - Keep `ENABLE_DOCS=false` anywhere non-local.
  - Do not put this service on a public network until authentication and authorization exist.
- **No Instagram/Meta tokens, API keys or AI credentials** exist in code, the schema or the configuration. There is no OAuth flow, and the backend never asks for Instagram passwords.
- **Nothing is published or sent.** No endpoint publishes campaigns, posts replies, sends DMs or WhatsApp messages, or emails reports. Features that would need an external integration return `501`.
- **Credentials stay local.** `.env` holds them and is git-ignored. `.env.example` contains placeholders only.
