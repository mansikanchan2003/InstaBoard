# Environment variable reference

Generated from `backend/app/core/config.py` (2026-10-11). Variables are case-insensitive. **Secret** = server-side only, never commit or log.
Production startup refuses unsafe values (see docs/OPERATIONS.md). Compose-only variables: `POSTGRES_USER/PASSWORD/DB`, `REDIS_PASSWORD`, `WEB_PORT`, `WEB_BIND`, `BACKEND_IMAGE`, `WEB_IMAGE`, `WEB_CONCURRENCY`, `FORWARDED_ALLOW_IPS`.

Frontend build-time variables: `VITE_DATA_SOURCE` (`demo` | `api`) and `VITE_API_BASE_URL` (`/api/v1` in the Docker image). Neither is secret.

## Core

| Variable | Default | Notes |
| --- | --- | --- |
| `APP_ENV` | `development` |  |
| `DATABASE_URL` | **required** | Secret. |
| `DATABASE_ECHO` | `False` |  |
| `DB_POOL_SIZE` | `5` |  |
| `DB_MAX_OVERFLOW` | `5` |  |
| `API_PREFIX` | `/api/v1` |  |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` |  |
| `ENABLE_DOCS` | `True` |  |
| `MAX_REQUEST_BYTES` | `1048576` |  |
| `LOG_FORMAT` | `text` |  |
| `LOG_LEVEL` | `INFO` |  |
| `FRONTEND_URL` | `http://localhost:5173` |  |

## Sessions & security

| Variable | Default | Notes |
| --- | --- | --- |
| `SECRET_KEY` | — | Secret. |
| `SESSION_COOKIE_NAME` | `instaboard_session` |  |
| `SESSION_IDLE_MINUTES` | `120` |  |
| `SESSION_MAX_AGE_HOURS` | `24` |  |
| `COOKIE_SECURE` | `False` |  |
| `COOKIE_SAMESITE` | `lax` |  |
| `COOKIE_DOMAIN` | — |  |
| `INVITATION_TTL_HOURS` | `72` |  |
| `LOGIN_ATTEMPTS_PER_WINDOW` | `5` |  |
| `LOGIN_WINDOW_SECONDS` | `900` |  |
| `AUTH_REQUESTS_PER_MINUTE_PER_IP` | `30` |  |
| `MIN_PASSWORD_LENGTH` | `12` |  |

## Instagram (Meta)

| Variable | Default | Notes |
| --- | --- | --- |
| `INSTAGRAM_APP_ID` | — |  |
| `INSTAGRAM_APP_SECRET` | — | Secret. |
| `INSTAGRAM_REDIRECT_URI` | — |  |
| `INSTAGRAM_GRAPH_API_VERSION` | — |  |
| `INSTAGRAM_OAUTH_SCOPES` | `instagram_business_basic,instagram_business_manage_insights` |  |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY` | — | Secret. |
| `INSTAGRAM_TOKEN_KEY_VERSION` | `1` |  |
| `INSTAGRAM_TOKEN_PREVIOUS_KEYS` | — | Secret. |
| `INSTAGRAM_HTTP_TIMEOUT_SECONDS` | `10.0` |  |
| `INSTAGRAM_HTTP_MAX_RETRIES` | `2` |  |
| `INSTAGRAM_RETRY_BACKOFF_SECONDS` | `0.5` |  |
| `INSTAGRAM_OAUTH_STATE_TTL_SECONDS` | `600` |  |

## Background sync

| Variable | Default | Notes |
| --- | --- | --- |
| `REDIS_URL` | — | Secret. |
| `SYNC_SCHEDULER_ENABLED` | `True` |  |
| `INSTAGRAM_SYNC_MAX_MEDIA` | `50` |  |
| `INSTAGRAM_SYNC_MAX_MEDIA_INSIGHTS` | `25` |  |
| `INSTAGRAM_SYNC_MAX_COMMENT_MEDIA` | `10` |  |
| `INSTAGRAM_SYNC_COOLDOWN_SECONDS` | `60` |  |
| `INSTAGRAM_SYNC_INTERVAL_MINUTES` | `360` |  |
| `INSTAGRAM_SCHEDULER_TICK_SECONDS` | `300` |  |
| `INSTAGRAM_SCHEDULER_BATCH_SIZE` | `20` |  |
| `INSTAGRAM_JOB_MAX_RETRIES` | `3` |  |
| `INSTAGRAM_JOB_RETRY_BASE_SECONDS` | `60` |  |
| `INSTAGRAM_JOB_RETRY_MAX_SECONDS` | `3600` |  |
| `INSTAGRAM_JOB_LEASE_SECONDS` | `900` |  |
| `INSTAGRAM_WORKER_CONCURRENCY` | `2` |  |
| `INSTAGRAM_BACKFILL_BATCH_SIZE` | `100` |  |
| `INSTAGRAM_RECENT_MEDIA_DAYS` | `30` |  |
| `INSTAGRAM_RECENT_INSIGHTS_REFRESH_HOURS` | `24` |  |
| `INSTAGRAM_OLDER_INSIGHTS_REFRESH_DAYS` | `7` |  |
| `INSTAGRAM_INSIGHTS_MAX_AGE_DAYS` | `730` |  |
| `INSTAGRAM_COMMENT_PAGES_PER_MEDIA` | `2` |  |

## AI

| Variable | Default | Notes |
| --- | --- | --- |
| `AI_PROVIDER` | `none` |  |
| `AI_MODEL` | — |  |
| `AI_API_KEY` | — | Secret. |
| `AI_BASE_URL` | — |  |
| `AI_TIMEOUT_SECONDS` | `45.0` |  |
| `AI_MAX_RETRIES` | `2` |  |
| `AI_RETRY_BACKOFF_SECONDS` | `2.0` |  |
| `AI_MAX_INPUT_CHARS` | `24000` |  |
| `AI_MAX_OUTPUT_TOKENS` | `2000` |  |
| `AI_MONTHLY_TOKEN_LIMIT` | `500000` |  |
| `AI_DAILY_REQUEST_LIMIT` | `500` |  |
| `AI_COMMENT_BATCH_SIZE` | `20` |  |
| `AI_COMMENT_JOB_LIMIT` | `200` |  |
| `AI_INSIGHT_CACHE_HOURS` | `24` |  |
| `AI_INSIGHT_TTL_DAYS` | `14` |  |
| `AI_MAX_INSIGHTS_PER_RUN` | `6` |  |
| `AI_ANALYSIS_MAX_DAYS` | `366` |  |
| `AI_SCHEDULED_INSIGHTS_ENABLED` | `False` |  |

