"""Application settings loaded from environment variables (and backend/.env in development)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


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


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment
