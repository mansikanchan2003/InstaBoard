"""Application settings loaded from environment variables (and backend/.env in development)."""

from __future__ import annotations

import logging
import secrets
from functools import cached_property, lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, PostgresDsn, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
logger = logging.getLogger("instaboard.config")

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

    @field_validator("secret_key", "cookie_domain", mode="before")
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
