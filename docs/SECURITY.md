# InstaBoard security notes

This document describes the security controls that exist and how they were verified. It is **not** a compliance certification: no SOC 2, ISO 27001 or GDPR assessment has been performed.

## Controls in place (with tests)

| Area | Control | Verified by |
| --- | --- | --- |
| Authentication | Argon2id password hashes, generic login errors, rate limits shared through Redis when configured, server-side sessions (HttpOnly, Secure in production, SameSite=Lax) with idle and absolute expiry, and revocation. | `test_auth.py`, `test_hardening.py` |
| CSRF | Session-bound `X-CSRF-Token` on every unsafe method, plus an `Origin` allowlist. | `test_auth.py`, production smoke test |
| Authorization | Every `/api/v1` operation requires a session, except 7 public, self-protecting ones. Role permissions are checked per route. | `test_rbac.py`: walks all 115 operations from the OpenAPI schema |
| Tenant isolation | An ORM-level workspace filter applies to every query, plus a write guard. Objects from another workspace return 404. | `test_isolation.py`, `test_instagram.py`, `test_sync_jobs.py`, `test_ai.py` |
| Provisioning | No public registration. The first owner is created with the `create_owner` CLI; everyone else joins through single-use, expiring invitation links. | `test_auth.py` |
| Instagram OAuth | Single-use, session-bound `state` (only its hash is stored). Redirects go only to `FRONTEND_URL`. The code exchange happens server-side. Tokens are Fernet-encrypted at rest and never returned or logged. | `test_instagram.py` |
| AI | Comment and lead text is sanitised, passed as delimited JSON data under aliases, with no tools and closed output enums. Every numeric claim is verified against database evidence. Usernames and contact data are never sent. | `test_ai.py`, `test_ai_evaluation.py` |
| HTTP | Security headers on the API (CSP `default-src 'none'`, `nosniff`, frame denial, `no-referrer`, `no-store`, HSTS in production) and on the web app (strict CSP). Request bodies are limited to 1 MiB (413). | `test_hardening.py`, production smoke test |
| Logging | Structured logs with request and job IDs, redaction of tokens, cookies, passwords and keys, and database errors logged without values. | `test_hardening.py`; no secrets found in smoke-test container logs |
| Production config | Startup refuses weak or missing secrets, insecure cookies, localhost or http origins, enabled docs, an http frontend, SQL echo, debug logging, and half-configured integrations. | `test_auth.py`, `test_hardening.py`, smoke test |
| Containers | Non-root users, read-only root filesystems, `no-new-privileges`. Database and Redis are not published. No secrets in images. | CI `docker` job, local image inspection |
| Dependencies | `pip-audit` is clean (after the FastAPI 0.142 / Starlette 1.7 upgrade). `npm audit` reports no high or critical issues. | CI `security` job, local runs on 2026-10-11 |
| Secrets in git | The history scan found no committed credentials (2026-10-11). `gitleaks` runs in CI. | Local history grep, CI |

## Known limitations and residual risks

- **react-router 6 open-redirect advisory (moderate).** The only user-controlled redirect, `?next=`, is validated by `safeNext`. The real fix is upgrading to react-router 7, which is a breaking upgrade and is not done.
- **List endpoints return whole result sets** (campaigns, content, leads, comments, insights, reports, notifications). They are workspace-scoped, and the current datasets are small. Add pagination before workspaces grow to many thousands of rows.
- **Rate limiting** is per IP (and per email+IP for failed logins), shared through Redis. If Redis is down it degrades to per-process limits. There is no CAPTCHA, account lockout or MFA.
- **No email-based password reset or verification.** Admins re-invite users instead.
- **HTTPS is not terminated by the stack itself.** TLS must be provided in front of `web`. HSTS for the whole site should be set at the TLS terminator.
- **Encryption key custody.** Losing `INSTAGRAM_TOKEN_ENCRYPTION_KEY` forces every account to reconnect. Key rotation is supported (versioned keys) but manual.
- **Data retention:**
  - **Removed automatically:** disconnecting an account deletes its token and all fetched Instagram data. The Meta data-deletion callback purges the data and the provider identifiers.
  - **Kept until workspace deletion:** audit and activity logs, sync and AI job history, and AI classifications/summaries of workspace comments and leads.
  - **Missing:** there is no automated retention window for these yet.
- **AI providers** receive aggregate metrics, comment text, and lead first messages (lead summaries). Their retention and training policies are the provider's. Review your provider agreement before enabling AI on real customer data.
- **Not verified locally:**
  - real Meta OAuth and Graph calls (all mocked);
  - real LLM calls (all mocked);
  - behaviour behind your actual TLS proxy or load balancer;
  - multi-host deployment;
  - off-host backup storage.

## Reporting

Report suspected vulnerabilities privately to the repository owner. Do not open public issues containing exploit details or real data.
