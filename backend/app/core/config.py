"""Application settings loaded from environment variables (and backend/.env in development)."""

from __future__ import annotations

import logging
import re
import secrets
from functools import cached_property, lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, PostgresDsn, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
logger = logging.getLogger("instaboard.config")

INSTAGRAM_REQUIRED_ENV = (
    "INSTAGRAM_APP_ID",
    "INSTAGRAM_APP_SECRET",
    "INSTAGRAM_REDIRECT_URI",
    "INSTAGRAM_GRAPH_API_VERSION",
    "INSTAGRAM_TOKEN_ENCRYPTION_KEY",
)
# Read-only Instagram Login scopes this phase may request (publishing / messaging need separate reviews).
INSTAGRAM_READ_SCOPES = frozenset({"instagram_business_basic", "instagram_business_manage_insights", "instagram_business_manage_comments"})

# Values that must never be used as a real signing secret.
_PLACEHOLDER_MARKERS = ("change-me", "changeme", "placeholder", "example", "secret", "password")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Eko InstaBoard API"
    app_env: Literal["development", "test", "production"] = "development"

    # Required — there is deliberately no default connection string.
    database_url: PostgresDsn
    database_echo: bool = False

    api_prefix: str = "/api/v1"
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])
    enable_docs: bool = True

    # --- authentication / sessions ---------------------------------------------------------
    # HMAC key for CSRF tokens and invitation tokens. REQUIRED in production (>= 32 random chars).
    # In development/test an ephemeral random key is generated when unset (sessions then end on restart).
    secret_key: SecretStr | None = None
    session_cookie_name: str = "instaboard_session"
    # Sliding inactivity timeout, renewed on every authenticated request…
    session_idle_minutes: int = Field(default=120, ge=5, le=24 * 60)
    # …up to this absolute lifetime, after which the user must log in again.
    session_max_age_hours: int = Field(default=24, ge=1, le=24 * 30)
    # Secure must be true whenever the app is served over HTTPS (enforced in production).
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict"] = "lax"
    cookie_domain: str | None = None
    invitation_ttl_hours: int = Field(default=72, ge=1, le=24 * 14)
    # Where invitation links point (the web app's origin).
    frontend_url: str = "http://localhost:5173"
    # Rate limits (per process — see README for multi-instance deployments).
    login_attempts_per_window: int = Field(default=5, ge=1)
    login_window_seconds: int = Field(default=900, ge=10)
    auth_requests_per_minute_per_ip: int = Field(default=30, ge=1)
    min_password_length: int = Field(default=12, ge=8, le=128)

    # --- Instagram API with Instagram Login (Phase 5) ---------------------------------------
    # The integration is enabled only when every required value below is set; with none of them set it
    # is cleanly disabled (demo data keeps working). A partial configuration is a startup error.
    # IDs come from App Dashboard > Instagram > API setup with Instagram login > Business login settings
    # (the *Instagram* app ID/secret, which differ from the Meta app ID/secret).
    instagram_app_id: str | None = None
    instagram_app_secret: SecretStr | None = None
    # Must exactly match a "Valid OAuth Redirect URI" in Business login settings; points at this API:
    #   http://localhost:8100/api/v1/integrations/instagram/callback  (https:// is required outside localhost)
    instagram_redirect_uri: str | None = None
    # Graph API version for graph.instagram.com calls, e.g. "v26.0". Deliberately no default (verify in Meta's changelog).
    instagram_graph_api_version: str | None = None
    # Read-only scopes requested at login. instagram_business_basic is mandatory; insights and comments are optional.
    instagram_oauth_scopes: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["instagram_business_basic", "instagram_business_manage_insights"]
    )
    # Fernet key (urlsafe base64, 32 bytes) used to encrypt access tokens at rest, and its version number.
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    instagram_token_encryption_key: SecretStr | None = None
    instagram_token_key_version: int = Field(default=1, ge=1, le=10_000)
    # Retired keys still needed to decrypt older tokens during rotation: "1:<key>,2:<key>".
    instagram_token_previous_keys: SecretStr | None = None
    # HTTP behaviour and bounded manual sync.
    instagram_http_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    instagram_http_max_retries: int = Field(default=2, ge=0, le=5)
    instagram_retry_backoff_seconds: float = Field(default=0.5, ge=0, le=10)
    instagram_oauth_state_ttl_seconds: int = Field(default=600, ge=60, le=3600)
    instagram_sync_max_media: int = Field(default=50, ge=1, le=500)
    instagram_sync_max_media_insights: int = Field(default=25, ge=0, le=200)
    instagram_sync_max_comment_media: int = Field(default=10, ge=0, le=100)
    instagram_sync_cooldown_seconds: int = Field(default=60, ge=0, le=3600)

    # --- Background synchronization (Phase 6) ------------------------------------------------
    # Redis is only the Celery broker ("doorbell"); PostgreSQL job rows are the source of truth.
    # Without REDIS_URL manual syncs cannot be queued (the API answers 503) and nothing is scheduled.
    redis_url: str | None = None
    sync_scheduler_enabled: bool = True
    # Conservative default: each connected account is synced at most every 6 hours (see README on Meta limits).
    instagram_sync_interval_minutes: int = Field(default=360, ge=15, le=7 * 24 * 60)
    instagram_scheduler_tick_seconds: int = Field(default=300, ge=30, le=3600)
    instagram_scheduler_batch_size: int = Field(default=20, ge=1, le=500)
    instagram_job_max_retries: int = Field(default=3, ge=0, le=10)
    instagram_job_retry_base_seconds: int = Field(default=60, ge=1, le=3600)
    instagram_job_retry_max_seconds: int = Field(default=3600, ge=1, le=24 * 3600)
    # A running job whose lease expires (worker crashed / was killed) is recovered by the maintenance task.
    instagram_job_lease_seconds: int = Field(default=900, ge=60, le=6 * 3600)
    instagram_worker_concurrency: int = Field(default=2, ge=1, le=32)
    # Incremental sync shape (per job).
    instagram_backfill_batch_size: int = Field(default=100, ge=0, le=1000)
    instagram_recent_media_days: int = Field(default=30, ge=1, le=365)
    instagram_recent_insights_refresh_hours: int = Field(default=24, ge=1, le=24 * 30)
    instagram_older_insights_refresh_days: int = Field(default=7, ge=1, le=365)
    # Meta keeps media insights for up to 2 years; older media are not queried.
    instagram_insights_max_age_days: int = Field(default=730, ge=1, le=730)
    instagram_comment_pages_per_media: int = Field(default=2, ge=1, le=20)

    @field_validator("secret_key", "cookie_domain", "redis_url", "instagram_app_id", "instagram_app_secret", "instagram_redirect_uri",
                     "instagram_graph_api_version", "instagram_token_encryption_key", "instagram_token_previous_keys", mode="before")
    @classmethod
    def _blank_is_unset(cls, value: object) -> object:
        # `SECRET_KEY=` in .env must mean "not set", never an empty signing key.
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("instagram_oauth_scopes", mode="before")
    @classmethod
    def _split_scopes(cls, value: object) -> object:
        if isinstance(value, str):
            return [scope.strip() for scope in value.replace(" ", ",").split(",") if scope.strip()]
        return value

    @field_validator("instagram_oauth_scopes")
    @classmethod
    def _read_only_scopes(cls, value: list[str]) -> list[str]:
        unknown = [scope for scope in value if scope not in INSTAGRAM_READ_SCOPES]
        if unknown:
            raise ValueError(
                f"INSTAGRAM_OAUTH_SCOPES may only contain {', '.join(sorted(INSTAGRAM_READ_SCOPES))} "
                f"(publishing and messaging are out of scope); got: {', '.join(unknown)}"
            )
        if "instagram_business_basic" not in value:
            raise ValueError("INSTAGRAM_OAUTH_SCOPES must include instagram_business_basic")
        return list(dict.fromkeys(value))

    @field_validator("instagram_graph_api_version")
    @classmethod
    def _api_version(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"v\d{1,3}\.\d", value):
            raise ValueError("INSTAGRAM_GRAPH_API_VERSION must look like v26.0")
        return value

    @field_validator("cors_origins")
    @classmethod
    def _no_wildcard_with_credentials(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("CORS_ORIGINS must list explicit origins; '*' is not allowed because credentials are enabled")
        return value

    @field_validator("database_url")
    @classmethod
    def _psycopg_driver(cls, value: PostgresDsn) -> PostgresDsn:
        if not str(value).startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must use the psycopg 3 driver: postgresql+psycopg://user:password@host:port/db")
        return value

    @model_validator(mode="after")
    def _instagram_config_complete(self) -> Settings:
        """All-or-nothing: a half-configured integration fails loudly instead of misbehaving later."""
        missing = self.instagram_missing_config
        if missing and len(missing) < len(INSTAGRAM_REQUIRED_ENV):
            raise ValueError("Incomplete Instagram integration configuration; also set: " + ", ".join(missing))
        if self.instagram_token_encryption_key is not None:
            from cryptography.fernet import Fernet

            try:
                Fernet(self.instagram_token_encryption_key.get_secret_value().encode())
            except (ValueError, TypeError):
                raise ValueError("INSTAGRAM_TOKEN_ENCRYPTION_KEY must be a Fernet key (urlsafe base64 of 32 bytes)") from None
        if self.instagram_redirect_uri is not None:
            uri = self.instagram_redirect_uri
            local = uri.startswith(("http://localhost", "http://127.0.0.1"))
            if not (uri.startswith("https://") or (local and self.app_env != "production")):
                raise ValueError("INSTAGRAM_REDIRECT_URI must use https:// (http://localhost is allowed outside production)")
            if not uri.rstrip("/").endswith("/integrations/instagram/callback"):
                raise ValueError("INSTAGRAM_REDIRECT_URI must point at <API>/integrations/instagram/callback")
        return self

    @property
    def instagram_missing_config(self) -> list[str]:
        """Names (never values) of required Instagram settings that are not set."""
        values = {
            "INSTAGRAM_APP_ID": self.instagram_app_id,
            "INSTAGRAM_APP_SECRET": self.instagram_app_secret,
            "INSTAGRAM_REDIRECT_URI": self.instagram_redirect_uri,
            "INSTAGRAM_GRAPH_API_VERSION": self.instagram_graph_api_version,
            "INSTAGRAM_TOKEN_ENCRYPTION_KEY": self.instagram_token_encryption_key,
        }
        return [name for name in INSTAGRAM_REQUIRED_ENV if values[name] is None]

    @property
    def instagram_enabled(self) -> bool:
        return not self.instagram_missing_config

    @model_validator(mode="after")
    def _production_guards(self) -> Settings:
        """Refuse to start a production deployment with missing or weak security settings."""
        if self.app_env != "production":
            return self
        problems: list[str] = []
        key = self.secret_key.get_secret_value() if self.secret_key else ""
        if len(key) < 32:
            problems.append("SECRET_KEY must be set to at least 32 random characters")
        elif any(marker in key.lower() for marker in _PLACEHOLDER_MARKERS):
            problems.append("SECRET_KEY looks like a placeholder; generate one with `python -c \"import secrets; print(secrets.token_urlsafe(48))\"`")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE must be true in production (serve the API over HTTPS)")
        if any(o.startswith("http://") and "localhost" not in o and "127.0.0.1" not in o for o in self.cors_origins):
            problems.append("CORS_ORIGINS must use https:// origins in production")
        if any("localhost" in o or "127.0.0.1" in o for o in self.cors_origins):
            problems.append("CORS_ORIGINS must not include localhost in production")
        if problems:
            raise ValueError("Unsafe production configuration: " + "; ".join(problems))
        return self

    @cached_property
    def signing_key(self) -> bytes:
        """Key for HMAC-derived tokens. Ephemeral (per process) only outside production."""
        if self.secret_key:
            return self.secret_key.get_secret_value().encode()
        logger.warning("SECRET_KEY is not set — using an ephemeral development key (sessions end when the server restarts).")
        return secrets.token_bytes(48)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment
