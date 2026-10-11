"""Handling of untrusted text and verification of model claims.

* ``sanitize_untrusted`` — strips control characters / zero-width characters, collapses whitespace and bounds length,
  so comment text can only ever be *data* inside a JSON payload.
* ``injection_suspected`` — heuristic flag for text that tries to address the model ("ignore previous instructions",
  role markers, tool syntax…). Flagged comments are classified like any other but always routed to human review.
* ``unverified_numbers`` — every number in a generated insight must match a value from the evidence it cites.
"""

from __future__ import annotations

import re
import unicodedata

_CONTROL = re.compile(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏ -‮⁠-⁤﻿]")
_INJECTION = re.compile(
    r"(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|system)\s+(instructions?|prompts?|rules?|messages?)"
    r"|\b(system|assistant|developer)\s*(prompt|message|:)"
    r"|you\s+are\s+now\b|act\s+as\s+(an?\s+)?(admin|system|developer)"
    r"|</?(system|instructions?|tool|function)[^>]*>|```\s*(system|json|tool)"
    r"|\b(call|invoke|run|execute)\s+(the\s+)?(tool|function|command)"
    r"|(reveal|print|show)\s+(the\s+|your\s+)?(system\s+)?(prompt|instructions|api\s*key|secret)",
    re.IGNORECASE,
)
_NUMBER = re.compile(r"(?<![\w.])[-+]?\d[\d,]*(?:\.\d+)?%?")


def sanitize_untrusted(text: str | None, *, max_chars: int = 1000) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKC", text)
    cleaned = _CONTROL.sub("", normalized)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_chars]


def injection_suspected(text: str | None) -> bool:
    return bool(text) and bool(_INJECTION.search(unicodedata.normalize("NFKC", text or "")))


def _as_number(token: str) -> float | None:
    try:
        return float(token.replace(",", "").rstrip("%"))
    except ValueError:
        return None


def unverified_numbers(texts: list[str], allowed: list[float], *, rel_tol: float = 0.011) -> list[str]:
    """Numbers in ``texts`` that do not match any ``allowed`` value (±1.1 % or exact for small integers).

    Small integers 0–12 are exempt (list counts, "2 campaigns", months), as are 4-digit years 1900–2100.
    Values may be written rounded (e.g. 12.4% for 12.37) — the tolerance covers one decimal of rounding.
    """
    bad: list[str] = []
    for text in texts:
        for token in _NUMBER.findall(text or ""):
            value = _as_number(token)
            if value is None:
                continue
            if float(value).is_integer() and (0 <= value <= 12 or 1900 <= value <= 2100) and "%" not in token:
                continue
            if not any(_close(value, a, rel_tol) for a in allowed):
                bad.append(token)
    return bad


def _close(value: float, allowed: float, rel_tol: float) -> bool:
    if allowed == value:
        return True
    scale = max(abs(allowed), abs(value), 1e-9)
    if abs(value - allowed) / scale <= rel_tol:
        return True
    # Compact formats: 12.5K / 1.2M written as 12.5 / 1.2 with the unit dropped are not accepted; but rounding to
    # one decimal of a percentage or to an integer is (12.37 → 12.4, 1203 → 1,203).
    return round(allowed, 1) == value or round(allowed) == value
