# InstaBoard operations runbook

This covers the production Compose deployment (`docker-compose.prod.yml`). For local development, see the root README.

## Architecture

```
                 HTTPS (TLS terminated by your load balancer / ingress / Caddy / nginx)
                                          │
                               ┌──────────▼──────────┐   published port (127.0.0.1:8080 by default)
                               │ web  (nginx, :8080) │   static React build + /api reverse proxy
                               └──────────┬──────────┘
            private network "instaboard-prod_private" — nothing below is published
          ┌───────────────┬───────────────┼────────────────┬───────────────┐
   ┌──────▼─────┐  ┌──────▼─────┐  ┌──────▼──────┐  ┌──────▼─────┐  ┌──────▼────┐
   │ api (:8000)│  │ worker     │  │ beat (1×)   │  │ db (PG 17) │  │ redis 7.4 │
   │ uvicorn    │  │ celery     │  │ celery beat │  │ volume     │  │ AOF volume│
   └────────────┘  └────────────┘  └─────────────┘  └────────────┘  └───────────┘
        migrate (one-shot: `alembic upgrade head`) runs before api/worker/beat start
```

| Service | Exposed | Notes |
| --- | --- | --- |
| `web` | yes, `${WEB_BIND:-127.0.0.1}:${WEB_PORT:-8080}` | Same-origin SPA and `/api` proxy. Put TLS in front. |
| `api`, `worker`, `beat` | no | One backend image; non-root (UID 10001), read-only filesystem, `no-new-privileges`. |
| `db`, `redis` | no | Never publish them. Redis requires `REDIS_PASSWORD`. |
| `migrate` | no | Exits after migrating; api, worker and beat wait for it to succeed. |

**Compose project names:**

- The production stack is project **`instaboard-prod`**, and its containers are named `instaboard-prod-<service>-1`.
- The development `docker-compose.yml` is project `instaboard`.
- They must stay distinct: two projects with the same name and service names replace each other's containers.

## First deployment (staging or production)

```bash
cp deploy/env.production.example deploy/.env.production       # fill in: passwords, SECRET_KEY, FRONTEND_URL, CORS_ORIGINS …
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production build
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production up -d
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production ps
# optional demo dataset (staging only):
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production exec api python -m scripts.seed_demo_data
# first owner account (prompts for a password):
docker compose -f docker-compose.prod.yml --env-file deploy/.env.production exec api python -m scripts.create_owner --email you@example.com
```

**Startup refusals.** The API refuses to start in production if any of these hold:

- `SECRET_KEY` is weak or a placeholder;
- `COOKIE_SECURE` is false;
- `CORS_ORIGINS` contains http or localhost origins;
- `ENABLE_DOCS` is true;
- `FRONTEND_URL` is not https;
- `DATABASE_ECHO` is true;
- `LOG_LEVEL` is DEBUG;
- an integration is half-configured.

## Deploy a new version and roll back

1. **Back up first:** run `deploy/backup.sh`, then copy the dump off the host.
2. **Build, then restart:** `… build` and then `… up -d`. Compose re-runs `migrate`, which applies only new migrations, before restarting api, worker and beat. Workers get a warm shutdown (60 s grace), and an interrupted job is recovered by its lease.
3. **Verify:**
   - `… ps` shows healthy containers;
   - `GET /healthz` on web returns ok;
   - `docker compose … exec api python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/ready').read())"`
4. **Roll back:**
   - **If the new release added no migration:** redeploy the previous image tags (`BACKEND_IMAGE`, `WEB_IMAGE`).
   - **If it added migrations:** run `docker compose … run --rm api alembic downgrade <previous_revision>` *before* starting the old image, or restore the pre-deploy backup. Every migration in this repository ships a tested downgrade, but downgrades can drop columns added by the newer release.

## Backups and restore

| Command | Purpose |
| --- | --- |
| `deploy/backup.sh` | `pg_dump` custom format → `backups/instaboard-<UTC>.dump` plus `.sha256`, with a table-of-contents check. |
| `deploy/restore.sh FILE` | Restores into **`instaboard_restore_check`**, a separate database, and prints verification counts. |
| `deploy/restore.sh FILE --target-db instaboard --overwrite-live` | Replaces the live database. Asks you to type its name. Stop api, worker and beat first. |

**Verified locally on 2026-10-11:**

- **Dev database:** backup of the dev database, then a restore into an isolated database. The schema was at head and campaign/content counts matched the source.
- **Prod stack:** backup and restore against the freshly deployed production Compose stack. The schema was at head.

**Not verified:** restores against your real production data, and off-host copies.

**Recommendations (not guarantees):**

- Daily logical backups kept 14–30 days, plus a pre-deploy backup.
- Encrypted off-host storage.
- A restore test into a scratch database at least monthly.
- Targets of RPO ≤ 24 h and RTO ≤ 2 h for a single-host deployment. Use managed PostgreSQL with point-in-time recovery for a tighter RPO.
- The dump contains encrypted Instagram tokens. Keep `INSTAGRAM_TOKEN_ENCRYPTION_KEY` (and previous keys) backed up **separately**. Without them, restored connections must be reauthorized; nothing else is lost.

## Health, logs and metrics

| Check | Meaning |
| --- | --- |
| `web` → `GET /healthz` | nginx is up (container healthcheck). |
| `api` → `GET /health` | Process liveness, no database access (container healthcheck). |
| `api` → `GET /ready` | Database reachable (503 otherwise), plus `background.worker` / `background.scheduler`: `ok`, `stale` or `never`. |
| `worker` healthcheck | `celery inspect ping` every 60 s. |
| `GET /api/v1/ops/status` | Owner/Admin. Per-workspace job counts by status (24 h), average duration, last sync per account, AI usage, failures and latency, heartbeats, and any app-wide Meta rate-limit pause. |

**Logs:**

- **Format:** one JSON object per line (`LOG_FORMAT=json`): `ts` (UTC), `level`, `logger`, `message`, `request_id`, and `job_id` in worker task logs.
- **Request IDs:** nginx forwards `$request_id` as `X-Request-ID`. The API echoes it in the response header and logs it, so one ID ties together the browser, nginx and API logs.
- **Redaction:** OAuth codes/states, tokens, `password=`, bearer tokens, API keys and session cookies are masked. Database errors are logged without their message, because PostgreSQL can echo submitted values; only the type, SQLSTATE and stack frames are kept.
- **Collecting logs:** `docker compose … logs -f api worker beat`. Ship them with your log driver of choice.

**Error monitoring:** no external error-monitoring service is integrated. Use log-based alerts, for example on `level=ERROR` or on jobs in `failed` status.

## Worker and scheduler

- **Concurrency and replicas:**
  - `INSTAGRAM_WORKER_CONCURRENCY` sets threads/processes per worker container.
  - Scale workers with `--scale worker=N`; the per-account job guarantees hold across workers.
  - Run exactly **one** `beat`. A second one would only cause redundant ticks, because scheduling is protected by an advisory lock and a unique index.
- **Schedule:** periodic syncs every `INSTAGRAM_SYNC_INTERVAL_MINUTES` (default 360). Maintenance runs every 60 s: lease recovery, re-sending lost or due jobs, and housekeeping of expired sessions, OAuth states and the AI cache.
- **Stuck jobs:** a job cannot stay `running` past its lease (15 min for sync, 10 min for AI). Look at `/api/v1/ops/status` and the job's `errorCategory`.

## Secrets and rotation

| Secret | Rotation |
| --- | --- |
| `SECRET_KEY` | Signs CSRF tokens. Rotating it invalidates current CSRF tokens; users just reload the app, and sessions survive. |
| `POSTGRES_PASSWORD` | `ALTER USER … PASSWORD …` in the database, update `deploy/.env.production`, then `up -d`. |
| `REDIS_PASSWORD` | Update the env file and `up -d`. Queued messages are re-sent from PostgreSQL. |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY` | Set the new key with `INSTAGRAM_TOKEN_KEY_VERSION=n+1` and put the old one in `INSTAGRAM_TOKEN_PREVIOUS_KEYS="n:<old>"`. Tokens are re-encrypted when they are next used or refreshed. Remove the old key only after every account has synced. A lost key means accounts must reconnect. |
| `INSTAGRAM_APP_SECRET` | Rotate in the Meta App Dashboard, update the env file, restart. Existing tokens keep working. |
| `AI_API_KEY` | Rotate at the provider, update, restart. |

Keep `deploy/.env.production` out of git (it is ignored) and readable only by the deploy user. Prefer your platform's secret store if it has one.

## Meta (Instagram) operations

- **Setup and redirect URI:** setup is in `backend/README.md → Instagram integration`. In production the redirect URI is `https://<your-domain>/api/v1/integrations/instagram/callback`. The deauthorize and data-deletion callbacks are under the same prefix.
- **Needs reauthorization:** shown for expired, revoked or permission-removed tokens. The user clicks **Reconnect**; nothing is retried automatically.
- **Rate limits:** jobs back off and honour Meta's usage headers. An app-level limit (code 4) pauses all syncs until the hinted time.

## AI provider operations

- **Disabled by default.** Set `AI_PROVIDER`, `AI_MODEL` and `AI_API_KEY` in the env file to enable it.
- **Usage limits:** `AI_MONTHLY_TOKEN_LIMIT` and `AI_DAILY_REQUEST_LIMIT` are **InstaBoard-side** checks, not provider spending caps. Also set a hard budget in the provider console.
- **Provider outages:** they surface as `retrying` or `failed` AI jobs with categories such as `rate_limited`, `provider_unavailable` or `provider_auth`. Deterministic analytics keep working.

## Incident troubleshooting

| Symptom | Likely cause and action |
| --- | --- |
| `migrate` exits 1 | Read `docker compose … logs migrate`. A settings refusal names the bad variable; a database error usually means a wrong `POSTGRES_*` value. |
| API unhealthy, `/ready` 503 | Database down or credentials wrong. Check `db` logs and the `DATABASE_URL` composition. |
| 403 `csrf_failed` after a deploy | `SECRET_KEY` changed. Reload the page. |
| 403 "Request origin is not allowed" | `CORS_ORIGINS` doesn't contain the exact browser origin, including the scheme. |
| Logins rate-limited for everyone | Behind another proxy, the client IP is the proxy's. Make sure only `web` reaches `api` (it sets `X-Forwarded-For`), and keep `FORWARDED_ALLOW_IPS` scoped. |
| Jobs stay `queued` | The worker is down, or Redis is unreachable or has the wrong password. See `/ready` → `background.worker`. |
| No scheduled syncs | `beat` isn't running, `SYNC_SCHEDULER_ENABLED=false`, the account *Needs reauthorization*, or a Meta app rate-limit pause is active (`/ops/status`). |
| 413 `payload_too_large` | The request body is above `MAX_REQUEST_BYTES` (and nginx `client_max_body_size`). |
