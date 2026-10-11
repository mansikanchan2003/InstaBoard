# InstaBoard backend (Phases 2–5)

FastAPI + PostgreSQL backend for the existing InstaBoard frontend.

- It serves the frontend's **demonstration dataset**, imported into PostgreSQL. Every seeded row has `is_demo = true`; none of it is live Instagram data.
- **Authentication and workspace isolation** (Phase 4): email + password sign-in, server-side sessions in an HttpOnly cookie, CSRF protection, Owner/Admin/Editor/Viewer roles, and every tenant row scoped to a workspace. See [Authentication & authorization](#authentication--authorization-phase-4).
- **Instagram integration** (Phase 5): official Instagram Login OAuth plus bounded, read-only syncs. It is disabled unless configured; see [Instagram integration](#instagram-integration-phase-5).
- There is **no AI provider** yet.
- It has **not been deployed or penetration-tested**; read [Security boundaries](#security-boundaries) before exposing it anywhere.

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

Create the first sign-in account (the workspace Owner). There is no public sign-up; everyone else joins by invitation:

```bash
.venv/Scripts/python -m scripts.create_owner --email you@example.com          # prompts for the password (not echoed)
# options: --name "Display Name"  --workspace ws-eko-india  --member usr-priya  --platform-admin
```

The password is read with `getpass` (or from the `INSTABOARD_OWNER_PASSWORD` environment variable for scripted setups), checked against the password policy, and stored only as an Argon2id hash.

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
| `SECRET_KEY` | HMAC key for CSRF tokens. **Required in production** (≥ 32 random characters, not a placeholder); the app refuses to start otherwise. Blank in development means an ephemeral per-process key. |
| `SESSION_COOKIE_NAME`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN` | Session cookie attributes. `COOKIE_SECURE=true` is enforced in production. |
| `SESSION_IDLE_MINUTES`, `SESSION_MAX_AGE_HOURS` | Sliding idle timeout (default 120 min) and absolute lifetime (default 24 h). |
| `FRONTEND_URL`, `INVITATION_TTL_HOURS` | Base URL of invitation links and their lifetime (default 72 h). |
| `LOGIN_ATTEMPTS_PER_WINDOW`, `LOGIN_WINDOW_SECONDS`, `AUTH_REQUESTS_PER_MINUTE_PER_IP`, `MIN_PASSWORD_LENGTH` | Rate limits and password policy. |

In production (`APP_ENV=production`) startup also fails if `CORS_ORIGINS` contains `http://` or localhost origins.

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
| `leadService.updateStatus / updateDetails / createFromComment` | `PATCH /leads/{id}`, `POST /leads` | `Lead`; POST → `{lead, created}` (201 new / 200 existing handle) |
| `audienceService.summary / intelligence` | `GET /audience/summary`, `GET /audience/intelligence` | `AudienceSummary`, `AudienceIntelligence` |
| `commentsService.summary / sentimentTrend / list / get` | `GET /comments/summary`, `/comments/sentiment-trend`, `/comments` (`?status&sentiment&intent&contentId&campaignId`), `/comments/{id}` | `CommentSummary`, `SentimentTrendPoint[]`, `CommentListResult`, `InstagramComment` |
| `commentsService.update / bulkSetStatus` | `PATCH /comments/{id}`, `POST /comments/bulk` | `InstagramComment`, `{updated}` (no reply is posted to Instagram) |
| `commentsService.convertToLead` | `POST /comments/{id}/convert-to-lead` | `{lead, comment, created}` — atomic and idempotent (201 first time, 200 on repeats) |
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

## Write operations (Phase 3)

Every write runs in **one database transaction** that also adds its audit row, and is **committed before the
2xx response is returned**. Any failure rolls back the whole operation.

- **Inputs:** validated server-side; write payloads reject unknown fields (no mass assignment).
- **Read-only fields:** metrics, scores, AI classifications, ids and external Instagram ids cannot be set.
- **Error statuses:** `422` invalid input or business rule, `404` missing record, `409` invalid state transition or conflict.

| Endpoint | Example body | Notes |
| --- | --- | --- |
| `POST /campaigns` | `{"name": "Diwali CSP Push", "objective": "Lead Generation", "accountId": "acc-ekoindia", "startDate": "2024-11-01", "endDate": "2024-11-15", "targetRegions": ["Bihar"], "hashtags": ["#Eko"], "status": "draft"}` | `status` is `draft` or `scheduled` (scheduled needs dates). Never published to Instagram. |
| `PATCH /campaigns/{id}` | `{"status": "paused"}` or `{"name": "…", "leadGoal": 250}` | Editable: name, objective, dates, account (before start only), regions, hashtags, budget, lead goal, age group, status. |
| `PATCH /leads/{id}` | `{"status": "qualified"}` / `{"notes": "Called; documents pending"}` | Editable: status, notes, name, location, phoneMasked. Status changes set "last contact"; notes do not. |
| `POST /leads` | `{"name": "…", "handle": "manoj_y_up", "location": "Ballia, UP", "campaignId": "sbi-csp-october", "contentId": "sbi-csp-mitra-reel", "score": 81, "source": "comment", "firstMessage": "…"}` | De-duplicated by handle (case-insensitive). The content must belong to the campaign. |
| `POST /comments/{id}/convert-to-lead` | *(no body)* | Creates a lead linked via `leads.source_comment_id` and marks the comment `lead_created`. Repeats, or an existing lead with the same handle, link without duplicating. `409` if the comment has no campaign. |
| `PATCH /comments/{id}` | `{"status": "reviewed", "flagged": true}` | `lead_created` is only reachable through conversion. |
| `POST /comments/bulk` | `{"ids": ["…"], "status": "archived"}` | One audit entry per bulk action. |
| `PATCH /insights/{id}`, `PATCH /insights/actions/{id}` | `{"status": "dismissed"}`, `{"status": "done", "feedback": "…"}` | Stored demo insights only; no AI call. |
| `POST/PUT/PATCH /reports…` | see `ReportConfig` | Configuration only. Figures are computed from campaign data. Nothing is emailed or scheduled. |
| `PATCH /notifications/{id}`, `POST /notifications/mark-all-read`, `PUT /notifications/preferences` | `{"read": true}` | Read state and preferences persist. No email, SMS or WhatsApp delivery exists. |
| `PUT /settings`, `/workspace/members…` | `WorkspaceSettings` / `{"email": "…", "access": "Viewer"}` | Audited with a field-level diff. No invitation email is sent. |

**Campaign status transitions** (anything else returns `409` with `details.allowed`):

| From | Allowed next statuses |
| --- | --- |
| `draft` | `scheduled` (requires start and end dates) |
| `scheduled` | `draft`, `active`, `paused` |
| `active` | `paused`, `completed` |
| `paused` | `active`, `completed` |
| `completed` | none |

**Audit log:** these writes add an `activity_events` row with the session user as actor and a field-level diff:
- campaign create, edit and status changes
- lead create, edit and status changes
- comment conversion and bulk triage
- insight and recommendation status changes
- report create, edit, duplicate, regenerate, archive and restore
- notification preferences, settings and team changes

Free-text lead notes are recorded only as "updated", never copied into the audit log.

**Not implemented, because no UI exists for them yet:**
- editing content or media metadata
- comment tags, notes or manual intent reclassification

**Needs a later integration (returns `501`):**
- account sync and disconnect (Meta)
- insight regeneration (AI provider)

Replying to comments or DMs is not implemented anywhere.

## Authentication & authorization (Phase 4)

### Sessions

- **Server-side sessions.** `POST /auth/login` creates a row in `auth_sessions` and sets an **HttpOnly** cookie (`instaboard_session`, `SameSite=Lax`, `Secure` in production) containing a random 256-bit token. Only the token's SHA-256 digest is stored, so a database leak does not reveal usable sessions.
- **Why this design rather than JWTs:** sessions can be revoked immediately (logout, password change, member removal, "sign out other sessions"), nothing sensitive is readable by JavaScript, and there is a single same-site web client.
- **Expiry:** a sliding idle timeout (`SESSION_IDLE_MINUTES`) is renewed on use, at most once a minute, up to an absolute cap (`SESSION_MAX_AGE_HOURS`). Expired and revoked sessions get `401` (`session_expired` / `not_authenticated`) and the cookie is cleared.
- **CSRF:** every unsafe request (POST, PUT, PATCH, DELETE) must send `X-CSRF-Token`, an HMAC of the session derived with `SECRET_KEY` and returned by login and `/auth/me`. The frontend keeps it in memory only. The `Origin` header is also checked against `CORS_ORIGINS`. Failures return `403 csrf_failed`.
- **Passwords:** stored as Argon2id hashes only; a database CHECK rejects anything else. Length-first policy: minimum 12 characters; very repetitive passwords, a small list of obvious ones and passwords containing your name or email are rejected (no breached-password check yet). Hashes are upgraded on login when parameters change.
- **Login protection:**
  - Login answers with a generic "Invalid email or password." for both unknown emails and wrong passwords, and the verify time is equalised with a dummy hash.
  - Failed attempts are limited per email+IP (`LOGIN_ATTEMPTS_PER_WINDOW` in `LOGIN_WINDOW_SECONDS`), and all auth endpoints are limited per IP. Over the limit, the API returns `429` with `Retry-After`.
- **Onboarding:** admin-provisioned only.
  - `scripts.create_owner` creates the first Owner.
  - Owners and Admins invite people from Settings → Team, which returns a one-time link (`/accept-invite#token=…`, valid for 72 h; only its hash is stored; the token sits in the URL fragment, so it is never sent to or logged by a web server).
  - No email is sent; the inviter shares the link.
  - There is no public registration.
- **Audit:** sign-in, sign-out, password change, session revocation, invitations, acceptance, role changes and removals are written to the workspace activity log.

### Workspace isolation

- **Tenant ownership:** each of the 15 tenant tables (accounts, sync logs, campaigns, content, leads, comments, comment summaries, insights, actions, reports, notifications, activity, team members, workspace documents) has a non-null `workspace_id`.
- **Workspace comes from the session only**, never from the URL or the body.
- **Enforced in one place, `app/core/tenancy.py`:**
  - Once a request is authenticated, a SQLAlchemy `do_orm_execute` hook adds `workspace_id = :current` to every ORM SELECT, UPDATE and DELETE on tenant models, including joins, relationship loads and subqueries.
  - A `before_flush` guard stamps new rows with the current workspace and refuses to write rows that belong to another one.
- **Responses for other workspaces:** another workspace's resources are indistinguishable from missing ones (`404`), so IDs cannot be probed. Uniqueness (campaign and report codes, comment refs, lead handles) is per workspace.
- **Platform administrators** (`users.is_platform_admin`) are separate from workspace roles. They only get `GET /platform/workspaces`, a directory of workspace names and member counts, and no access to tenant data.

### Role matrix

| Capability | Owner | Admin | Editor | Viewer |
| --- | :-: | :-: | :-: | :-: |
| Read all workspace data, export CSV | ✓ | ✓ | ✓ | ✓ |
| Mark own notifications read/unread | ✓ | ✓ | ✓ | ✓ |
| Change password, manage own sessions | ✓ | ✓ | ✓ | ✓ |
| Write campaigns, leads, comments, insights, reports; dismiss notifications | ✓ | ✓ | ✓ | – |
| Workspace settings and notification preferences | ✓ | ✓ | – | – |
| Invite / change / remove Editors and Viewers | ✓ | ✓ | – | – |
| Instagram account management (sync/disconnect, still `501`) | ✓ | ✓ | – | – |
| Invite, promote to, or remove Admins | ✓ | – | – | – |
| Change or remove the Owner | – | – | – | – |

No one can change their own role, grant Owner, or remove the Owner. The "Member" role in the brief maps to **Editor** (read and write) and **Viewer** (read-only).

### Endpoints

| Endpoint | Auth |
| --- | --- |
| `POST /auth/login` | public, rate-limited |
| `POST /auth/invitations/preview`, `POST /auth/invitations/accept` | public, rate-limited, one-time token (sent in the body, never in a URL) |
| `GET /auth/me`, `POST /auth/logout`, `POST /auth/password` | session |
| `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `POST /auth/sessions/revoke-others` | session (own sessions only) |
| `GET /platform/workspaces` | session + platform admin |
| Every other `/api/v1/*` route (campaigns, content, comments, leads, insights, reports, accounts, notifications, activity, settings, workspace/team, search, exports, `/me/session`) | session + workspace scope + role permission above |
| `/health`, `/ready` | public (no data) |

`401` means not signed in, or the session is expired or revoked. `403` means signed in but the role lacks permission, or CSRF failed. `404` means the resource does not exist **in your workspace**.

### Migration

- **Phase 4 migration:** `20261011_b126a04be743_phase4_auth_and_workspace_isolation`. It creates `users`, `auth_sessions`, `invitations` and `workspace_documents`, then adds `workspace_id` to every tenant table.
- **Backfill:** existing rows get their workspace from their parent account, campaign or insight, or from the single existing workspace. The migration aborts rather than guess if several workspaces exist.
- **Other changes:** workspace-level documents move out of the global `reference_documents`, `team_members` gains `user_id`, and the downgrade path is complete.
- **Apply it:** `alembic upgrade head`, then `scripts.create_owner`.

### Tests

```bash
.venv/Scripts/python -m pytest -q tests/test_auth.py tests/test_isolation.py tests/test_rbac.py
```

- **`test_auth.py`:**
  - login success and failure, with an identical response for unknown emails;
  - Argon2id-only storage;
  - expired, idle and revoked sessions;
  - logout, password change and session revocation;
  - CSRF and Origin checks, rate limits;
  - invitations, including one-time use and expiry;
  - production configuration guards.
- **`test_isolation.py`:** a second workspace with its own data. Every list, detail, nested, search, export, notification, activity, settings and write route, including ID tampering, is checked for no cross-workspace reads or writes.
- **`test_rbac.py`:**
  - every route rejects anonymous requests with `401`;
  - Viewer, Editor and Admin limits;
  - privilege-escalation attempts (self-promotion, granting Owner, Admin managing Admins);
  - mass assignment rejected (`extra="forbid"`).

## Instagram integration (Phase 5)

InstaBoard connects **Instagram professional (Business or Creator) accounts** through Meta's official **Instagram API with Instagram Login** (Business Login for Instagram), then reads profile, media, insights and, optionally, comments. All of it is read-only: there is no publishing, no direct messages, no replies and no Ads API.

### Verified against Meta's documentation

These were checked on developers.facebook.com/docs/instagram-platform on 2026-10-11, and the docs listed `v26.0` as the latest API version.

| Step | Endpoint |
| --- | --- |
| Authorization window | `https://www.instagram.com/oauth/authorize` with `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`. The code is valid for 1 h and can be used once. |
| Code → short-lived token (1 h) | `POST https://api.instagram.com/oauth/access_token` (form body, server-side) |
| Short → long-lived token (60 days) | `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token` |
| Refresh (another 60 days) | `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`. Only allowed for tokens that are **≥ 24 h old and not expired**; a token not refreshed within 60 days expires for good and the user must reconnect. |
| Reads | `graph.instagram.com/{INSTAGRAM_GRAPH_API_VERSION}/me`, `/{ig-id}/media`, `/{media-id}/insights`, `/{ig-id}/insights`, `/{media-id}/comments` |

- **PKCE:** Meta documents `state`, but no PKCE parameters, for this flow, so none are sent.
- **Facebook Login:** not implemented. Instagram Login needs no Facebook Page and is Meta's recommended path for new integrations.

**Permissions (scopes).** All are read-only, configured through `INSTAGRAM_OAUTH_SCOPES`, and anything else is rejected at startup:

| Scope | Used for |
| --- | --- |
| `instagram_business_basic` (required) | `/me` profile fields and the media list |
| `instagram_business_manage_insights` (default) | Media and account insights |
| `instagram_business_manage_comments` (opt-in) | Reading comments. Meta's permission also allows replying and deleting; InstaBoard only reads. |

**Fields and metrics retrieved:**

- **Profile:** `id` (app-scoped), `user_id` (professional account ID), `username`, `name`, `account_type`, `profile_picture_url`, `followers_count`, `follows_count`, `media_count`.
- **Media:**
  - Always requested: `id`, `media_type`, `permalink`, `shortcode`, `timestamp`, `media_url`, `thumbnail_url`, `like_count`, `comments_count`.
  - Optional: `caption` and `media_product_type` are documented as *Facebook-Login-only*, so they are requested optimistically and dropped, with a sync warning, if the API rejects them.
- **Media insights** (lifetime, FEED/REELS): `views`, `reach`, `likes`, `comments`, `shares`, `saved`, `total_interactions`.
- **Account insights** (`metric_type=total_value`, `period=day`, last 28 days): `reach`, `views`, `accounts_engaged`, `total_interactions`, `likes`, `comments`, `shares`, `saves`. Daily `reach` is also fetched as a `time_series`.
- **Comments:** `id`, `text`, `timestamp`, `username`, `like_count`, `hidden`, `parent_id`, and replies.

**Not retrieved, on purpose:**

- `impressions`: deprecated for media created after 2024-07-02, and for account insights since v22.0.
- `plays`: no longer listed.
- Demographic metrics (`follower_demographics`, `engaged_audience_demographics`).
- `online_followers`, story metrics (24 h only), `facebook_views` / `crossposted_views` (these throw unless the media was shared to Facebook).
- Reel watch-time metrics; `total_*` and `saved_count` / `shares_count` fields (Facebook Login only).
- Direct messages, mentions, hashtags, the Ads API.

**Missing metrics are stored as `unavailable` with `NULL`, never as 0.** Meta returns an empty set instead of 0 when a metric doesn't apply, and data can lag up to 48 hours.

### Meta App Dashboard setup (done once by an admin)

1. Go to https://developers.facebook.com/apps, click **Create app**, choose the **Business** app type, and link a Business portfolio if asked.
2. **Add product → Instagram**, then **API setup with Instagram login**.
3. In **3. Set up Instagram business login → Business login settings**:
   - Add the OAuth redirect URI exactly as `INSTAGRAM_REDIRECT_URI`. For local development that is `http://localhost:8100/api/v1/integrations/instagram/callback`; in production use `https://<api-host>/api/v1/integrations/instagram/callback`. Meta may add a trailing slash, and the two must match exactly.
   - Copy the **Instagram app ID** and **Instagram app secret** into `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` in `backend/.env`. These are not the Meta app ID and secret.
   - Optional, needed for App Review: set the **Deauthorize callback URL** to `https://<api-host>/api/v1/integrations/instagram/deauthorize` and the **Data deletion request URL** to `https://<api-host>/api/v1/integrations/instagram/data-deletion`. Meta must be able to reach them, so they need a public HTTPS host.
4. **App roles → Roles → Instagram testers:** add the Instagram account(s) you will connect, then accept the invitation in that Instagram account under **Settings → Apps and websites → Tester invites**.
5. Set `INSTAGRAM_GRAPH_API_VERSION` to the current version (check the changelog), generate `INSTAGRAM_TOKEN_ENCRYPTION_KEY` (see `.env.example`), and restart the API. `GET /api/v1/integrations/instagram/status` should now report `"enabled": true`.

**Access levels and App Review:**

- **Standard Access:** while the app is in development mode with Standard Access, only accounts that have a role on the app (testers, admins, developers) can be connected.
- **Advanced Access:** needed to connect accounts you don't own or manage. That requires **App Review** for each permission (with a screencast of the flow), **Business Verification**, a privacy policy URL, and the data-deletion callback or instructions. Then switch the app to **Live** mode.
- **Not done here:** none of this has been submitted.

### Security model

- **OAuth state:** `POST /integrations/instagram/connect` (Owner/Admin, CSRF-protected) stores a SHA-256 digest of a random `state`, bound to the user, session and workspace, valid for 10 minutes.
- **Callback checks:** the callback:
  - consumes the state atomically, so replays and duplicate callbacks fail;
  - requires the **same signed-in session**;
  - re-checks the role;
  - handles `error=access_denied`;
  - exchanges the code server-side;
  - verifies the account is professional and that `/me` matches the token's user;
  - stores the connection in the **state's** workspace. Any workspace in the callback URL is ignored.

  It always redirects to `FRONTEND_URL/accounts?instagram=…` with a fixed set of reason codes.
- **Tokens:**
  - **Storage:** tokens are **encrypted with Fernet** (`cryptography`) using an environment-managed, versioned key, in `instagram_tokens`. The column is deferred-loaded and no API schema contains a token.
  - **Logs:** httpx request logging is silenced (URLs carry tokens), provider errors are logged by endpoint shape and Graph error code only, and uvicorn access logs mask `code`, `state`, `access_token`, `client_secret` and `signed_request`.
  - **Disconnect:** disconnecting deletes the token, so the account can no longer be called.
- **Reliability:**
  - 10 s timeouts.
  - Bounded retries (2) for timeouts, network errors, HTTP 5xx and Graph codes 1/2 or `is_transient`.
  - No retry on rate limits (codes 4/17/32/613, HTTP 429) or on token errors. Code 190 marks the account **Needs reauthorization**.
- **Manual sync:**
  - Bounded to 50 media, 25 media-insight lookups and 10 comment pages.
  - One run at a time per account, with a 60 s cooldown.
  - No background scheduler.

### Data provenance and retention

- **Separate tables:** live records live in dedicated tables (`instagram_connections`, `instagram_media`, `instagram_media_insights`, `instagram_account_insights`, `instagram_comments`, `instagram_sync_runs`), all with `workspace_id` and `source = instagram_api`. Provider IDs (`ig_user_id`, `ig_media_id`, `ig_comment_id`) are separate from internal IDs and unique per connection, which keeps upserts idempotent.
- **Demo data:** demo records stay in the original tables with `is_demo = true`, and live numbers are never added to demo totals.
- **Insight history:** media insights are snapshotted per sync (history kept). Account insights are keyed by their time range; re-fetching a range updates it, because Meta revises data for up to 48 h.
- **Disconnect (in InstaBoard):** deletes the token **and** all media, insights and comments of that account. A tombstone row (username, dates) and the sync audit remain. Other workspace data is untouched. To revoke Meta's grant as well, the user removes the app in Instagram (**Settings → Apps and websites**).
- **Deauthorize callback:** deletes the tokens and marks the account *Needs reauthorization*.
- **Data-deletion callback:** purges everything stored for that Instagram user, including the provider IDs, and returns `{url, confirmation_code}`. Users can check the status at `/integrations/instagram/data-deletion/{code}`.

### Endpoints

| Endpoint | Access |
| --- | --- |
| `GET /integrations/instagram/status` | any member |
| `POST /integrations/instagram/connect` | Owner/Admin (`accounts:manage`), CSRF |
| `GET /integrations/instagram/callback` | the initiating session + single-use state (called by Instagram's redirect) |
| `GET /integrations/instagram/accounts`, `/accounts/{id}`, `/media`, `/insights`, `/comments`, `/sync-runs` | any member (own workspace only) |
| `POST /integrations/instagram/accounts/{id}/sync` | Owner/Admin, CSRF |
| `POST /integrations/instagram/accounts/{id}/disconnect` | Owner/Admin, CSRF |
| `POST /integrations/instagram/deauthorize`, `POST /data-deletion`, `GET /data-deletion/{code}` | Meta's `signed_request` (HMAC-SHA256 with the app secret) |

### Tests

`tests/test_instagram.py` has 28 tests. They run against a **mocked** Meta (`httpx.MockTransport`) with fabricated, documented-shape responses; no credentials or network are needed. They cover:

- configuration;
- encryption and key rotation;
- anonymous and role checks;
- CSRF;
- the full OAuth flow;
- state replay, expiry and tampering;
- session binding;
- denial and malformed callbacks;
- missing permissions and non-professional accounts;
- pagination and idempotent re-sync;
- unavailable metrics;
- deleted media;
- retries, timeouts and rate limits;
- revoked, expired and refreshed tokens;
- disconnect;
- cross-workspace isolation;
- secrets absent from logs and responses;
- the deauthorize and data-deletion callbacks.

**No live Meta connection has been tested.** See *Testing with a real account* in the root README.

## Security boundaries

- **Not production-hardened yet.** Before any deployment:
  - serve over HTTPS with `APP_ENV=production` (which enforces `SECRET_KEY`, `COOKIE_SECURE` and https-only CORS);
  - keep `ENABLE_DOCS=false`;
  - run behind a reverse proxy that sets the client IP.
- **Not implemented yet:**
  - email verification and self-service password reset (an admin re-invites instead);
  - multi-factor authentication and SSO;
  - account lockout beyond rate limiting, and audit entries for failed sign-ins (they are rate-limited, not logged);
  - a breached-password check (e.g. k-anonymity lookup);
  - a shared rate-limit store. Limits are per process, so several workers multiply them; use Redis or similar.
- **IP-based limits** use the direct client address. Behind a proxy, configure trusted forwarded headers, or every user shares the proxy's IP.
- **Dependency advisories:**
  - **Backend:** `pip-audit` (2026-10-11) reports advisories for **Starlette 0.41.3**, which is pinned by FastAPI 0.115.6. Upgrading FastAPI/Starlette is the next maintenance task.
  - **Frontend:** `npm audit` reports a react-router 6 open-redirect advisory (backslash paths). The app's only user-controlled redirect (`?next=`) is validated by `safeNext`, which rejects backslashes and absolute URLs. The remaining advisories are dev and test tooling only.
- **Instagram tokens** exist only server-side: encrypted in `instagram_tokens`, never in code, responses or logs. The app secret and encryption key live only in `backend/.env`. The backend never sees Instagram passwords, because users sign in on instagram.com. There are no AI credentials.
- **Nothing is published or sent.** No endpoint publishes to Instagram, posts replies, sends DMs or WhatsApp messages, or emails reports or invitations. The demo-account sync and disconnect endpoints (`/accounts/{id}/sync`, `DELETE /accounts/{id}`) still return `501`.
- **Credentials stay local.** `.env` holds them and is git-ignored. `.env.example` contains placeholders only.
