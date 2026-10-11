"""Structured logging with correlation IDs and redaction.

* ``LOG_FORMAT=json`` (default in production) emits one JSON object per line:
  ``{"ts", "level", "logger", "message", "request_id", "job_id", ...}``; ``text`` is a readable dev format.
* ``request_id`` / ``job_id`` come from context variables set by the request middleware and the workers.
* ``RedactingFilter`` masks token-like query parameters and bearer/cookie values in every message, so a stray log
  line cannot leak OAuth codes, access tokens, session cookies or API keys. Application code additionally never
  logs prompts, comment text, passwords or tokens.
"""

from __future__ import annotations

import contextvars
import json
import logging
import re
import sys
from datetime import datetime, timezone

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)
job_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("job_id", default=None)

_PATTERNS = [
    (re.compile(r"(?<![A-Za-z0-9_])((?:code|state|signed_request|access_token|client_secret|token|password|api_key|key)=)[^&\s\"']+", re.I), r"\1[redacted]"),
    (re.compile(r"(authorization:\s*bearer\s+)[A-Za-z0-9._~+/=-]+", re.I), r"\1[redacted]"),
    (re.compile(r"(x-api-key:\s*)\S+", re.I), r"\1[redacted]"),
    (re.compile(r"(instaboard_session=)[^;\s\"']+", re.I), r"\1[redacted]"),
]


def redact(text: str) -> str:
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # noqa: BLE001 — never let logging break the app
            return True
        cleaned = redact(message)
        if cleaned != message:
            record.msg, record.args = cleaned, None
        record.request_id = request_id_var.get()
        record.job_id = job_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in ("request_id", "job_id"):
            value = getattr(record, key, None)
            if value:
                payload[key] = value
        for key in ("method", "path", "status", "duration_ms", "client"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        if record.exc_info:
            payload["exception"] = redact(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False)


class TextFormatter(logging.Formatter):
    def __init__(self) -> None:
        super().__init__("%(asctime)s %(levelname)s %(name)s [%(request_id)s%(job_id)s] %(message)s")

    def format(self, record: logging.LogRecord) -> str:
        record.request_id = getattr(record, "request_id", None) or "-"
        job = getattr(record, "job_id", None)
        record.job_id = f" job={job}" if job else ""
        return redact(super().format(record))


_configured = False


def configure_logging(*, fmt: str = "text", level: str = "INFO") -> None:
    """Idempotent root logging setup for the API and the Celery processes."""
    global _configured
    root = logging.getLogger()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if fmt == "json" else TextFormatter())
    handler.addFilter(RedactingFilter())
    if _configured:
        for existing in list(root.handlers):
            if getattr(existing, "_instaboard", False):
                root.removeHandler(existing)
    handler._instaboard = True  # type: ignore[attr-defined]
    root.addHandler(handler)
    root.setLevel(level.upper())
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "celery"):
        lg = logging.getLogger(name)
        lg.addFilter(RedactingFilter())
    # Libraries that would log full request URLs (which can carry tokens) stay at WARNING.
    for noisy in ("httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    _configured = True
