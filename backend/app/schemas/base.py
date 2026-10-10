"""Schema base: camelCase JSON (matching frontend/src/types) with TypeScript-style optional fields.

TypeScript distinguishes ``field?: T`` (key absent) from ``field: T | null`` (key present, null).
Fields listed in a model's ``__omit_if_none__`` are dropped from the JSON when ``None``; every
other field — including nullable ones — is always emitted.
"""

from __future__ import annotations

from typing import Any, ClassVar

from pydantic import BaseModel, ConfigDict, model_serializer
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    __omit_if_none__: ClassVar[frozenset[str]] = frozenset()

    @model_serializer(mode="wrap")
    def _omit_optional(self, handler: Any) -> Any:
        data = handler(self)
        if not self.__omit_if_none__ or not isinstance(data, dict):
            return data
        for name in self.__omit_if_none__:
            field = type(self).model_fields[name]
            key = field.alias or name
            if key in data and data[key] is None:
                del data[key]
        return data


def optional(*names: str) -> frozenset[str]:
    return frozenset(names)


def num(value: float | int | None) -> float | int | None:
    """Emit integral floats as ints (2840000.0 → 2840000) so JSON matches the TypeScript demo data."""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


# Loose JSON document type for presentation payloads stored as JSONB.
JsonDoc = dict[str, Any]


def ev(value: object) -> object:
    """Enum → its string value; plain strings pass through (attributes set from request bodies are str
    until the row is reloaded)."""
    return getattr(value, "value", value)
