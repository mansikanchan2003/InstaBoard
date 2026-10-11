"""FastAPI application factory.

    uvicorn app.main:app --reload            # development server (http://localhost:8100)

Production requires APP_ENV=production, a strong SECRET_KEY, COOKIE_SECURE=true and HTTPS (see README).
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.database import build_engine, build_session_factory, check_connection
from app.core.errors import register_error_handlers
from app.core.security import RateLimiter

logger = logging.getLogger("instaboard.api")

DESCRIPTION = """
Backend for **Eko InstaBoard** (Instagram Campaign Intelligence Platform).

* All seeded records are **demonstration data** (`is_demo = true`) — not live Instagram data.
* There is **no Meta / Instagram integration** and **no AI provider** in this phase: endpoints that would
  need one (account sync, disconnect, insight regeneration) return `501 not_available`.
* **Authentication:** HttpOnly session cookie from `POST /api/v1/auth/login`; state-changing requests also need
  the `X-CSRF-Token` header (value from the login / `GET /auth/me` response). Every workspace endpoint is scoped
  to the session's workspace and checked against the caller's role (Owner / Admin / Editor / Viewer).
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.2.0",
        description=DESCRIPTION,
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.enable_docs else None,
    )
    app.state.settings = settings
    app.state.engine = build_engine(settings)
    app.state.session_factory = build_session_factory(app.state.engine)
    app.state.rate_limiter = RateLimiter()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept", "X-CSRF-Token"],
    )
    register_error_handlers(app)

    @app.get("/health", tags=["health"], summary="Liveness: the process is up (does not touch the database)")
    def health() -> dict[str, str]:
        return {"status": "ok", "environment": settings.app_env}

    @app.get("/ready", tags=["health"], summary="Readiness: the database is reachable",
             responses={503: {"description": "Database unreachable"}})
    def ready() -> JSONResponse:
        try:
            check_connection(app.state.engine)
        except Exception as exc:  # report unavailability without leaking connection details
            logger.warning("Readiness check failed: %s", exc.__class__.__name__)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"status": "unavailable", "checks": {"database": "unreachable"}},
            )
        return JSONResponse(content={"status": "ready", "checks": {"database": "ok"}})

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


def __getattr__(name: str):  # lazy so importing app.main never requires DATABASE_URL (e.g. in tests)
    if name == "app":
        return create_app()
    raise AttributeError(name)
