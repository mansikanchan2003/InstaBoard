"""Declarative base, shared column helpers and enum handling."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, MetaData, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Deterministic constraint names so Alembic migrations are stable.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map = {dict[str, Any]: JSONB, list[Any]: JSONB}


def str_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    """VARCHAR + CHECK constraint (not a native PG enum) storing the enum *values* the frontend uses."""
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=max(len(m.value) for m in enum_cls) + 8,
        values_callable=lambda cls: [m.value for m in cls],
        validate_strings=True,
    )


class TimestampMixin:
    """UTC-aware audit timestamps (timestamptz)."""

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class DemoMixin:
    """Marks rows imported from the frontend demonstration dataset (never live Instagram data)."""

    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")


class WorkspaceOwned:
    """Tenant-owned row. Every request runs with its authenticated workspace bound to the session, and
    a global query filter (``app.core.tenancy``) restricts every SELECT / UPDATE / DELETE on these
    models to that workspace — another tenant's ids simply do not exist for the request."""

    workspace_id: Mapped[str] = mapped_column(String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True)
