"""Provider adapters. Each turns (system prompt, user content, JSON schema) into a dict + usage, nothing more.

* ``AnthropicProvider`` — Messages API (``POST {base}/v1/messages``) with a single forced tool whose
  ``input_schema`` is the output schema, so the model must answer with structured tool input.
* ``OpenAICompatibleProvider`` — ``POST {base}/chat/completions`` with ``response_format: json_schema``
  (OpenAI and the many providers/gateways that implement the same endpoint).

No tools other than the output schema are ever offered, so model output cannot trigger actions. Adapters
map HTTP failures onto ``app.ai.errors``; they never log request bodies (which contain prompts) or keys.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from app.core.config import Settings

from .errors import AIAuthError, AIDisabledError, AIInvalidOutputError, AIProviderUnavailableError, AIRateLimitedError, AIRequestError, AITimeoutError

logger = logging.getLogger("instaboard.ai")
for _noisy in ("httpx", "httpcore"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

ANTHROPIC_DEFAULT_BASE = "https://api.anthropic.com"
ANTHROPIC_VERSION = "2023-06-01"


@dataclass
class ProviderResult:
    data: dict[str, Any]
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    latency_ms: int = 0
    raw_stop_reason: str | None = field(default=None, repr=False)


class AIProvider(Protocol):
    name: str
    model: str

    def complete_structured(self, *, system: str, user: str, schema_name: str, schema: dict[str, Any], max_output_tokens: int) -> ProviderResult: ...

    def close(self) -> None: ...


def _retry_after(response: httpx.Response) -> float | None:
    for header in ("retry-after", "x-ratelimit-reset-requests"):
        value = response.headers.get(header)
        if value:
            try:
                return float(value.rstrip("s"))
            except ValueError:
                continue
    return None


def _map_http_error(response: httpx.Response) -> Exception:
    status = response.status_code
    if status == 429:
        return AIRateLimitedError(retry_after=_retry_after(response))
    if status in (401, 403):
        return AIAuthError()
    if status == 404:
        return AIAuthError("The configured AI model or endpoint was not found. An administrator must check AI_MODEL / AI_BASE_URL.")
    if status in (408, 409) or status >= 500:  # 529 = Anthropic overloaded
        return AIProviderUnavailableError(retry_after=_retry_after(response))
    return AIRequestError()


class _HttpProvider:
    name = "base"

    def __init__(self, settings: Settings, *, transport: httpx.BaseTransport | None = None) -> None:
        if not settings.ai_enabled or settings.ai_model is None or settings.ai_api_key is None:
            raise AIDisabledError()
        self.model = settings.ai_model
        self._key = settings.ai_api_key.get_secret_value()
        self._http = httpx.Client(transport=transport, timeout=httpx.Timeout(settings.ai_timeout_seconds), follow_redirects=False)

    def close(self) -> None:
        self._http.close()

    def _post(self, url: str, *, headers: dict[str, str], body: dict) -> tuple[dict, int]:
        started = time.perf_counter()
        try:
            response = self._http.post(url, headers=headers, json=body)
        except httpx.TimeoutException:
            raise AITimeoutError() from None
        except httpx.HTTPError as exc:
            logger.warning("AI provider network error %s (%s)", exc.__class__.__name__, self.name)
            raise AIProviderUnavailableError() from None
        latency = int((time.perf_counter() - started) * 1000)
        if not response.is_success:
            logger.warning("AI provider error http=%s provider=%s model=%s", response.status_code, self.name, self.model)
            raise _map_http_error(response)
        try:
            payload = response.json()
        except ValueError:
            raise AIInvalidOutputError() from None
        if not isinstance(payload, dict):
            raise AIInvalidOutputError()
        return payload, latency


class AnthropicProvider(_HttpProvider):
    name = "anthropic"

    def __init__(self, settings: Settings, *, transport: httpx.BaseTransport | None = None) -> None:
        super().__init__(settings, transport=transport)
        self._base = (settings.ai_base_url or ANTHROPIC_DEFAULT_BASE).rstrip("/")

    def complete_structured(self, *, system: str, user: str, schema_name: str, schema: dict[str, Any], max_output_tokens: int) -> ProviderResult:
        body = {
            "model": self.model,
            "max_tokens": max_output_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "tools": [{"name": schema_name, "description": "Return the result in this exact structure.", "input_schema": schema}],
            "tool_choice": {"type": "tool", "name": schema_name},
        }
        headers = {"x-api-key": self._key, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json"}
        payload, latency = self._post(f"{self._base}/v1/messages", headers=headers, body=body)
        blocks = payload.get("content") or []
        tool = next((b for b in blocks if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") == schema_name), None)
        if tool is None or not isinstance(tool.get("input"), dict):
            raise AIInvalidOutputError()
        usage = payload.get("usage") or {}
        return ProviderResult(data=tool["input"], model=str(payload.get("model") or self.model), input_tokens=usage.get("input_tokens"),
                              output_tokens=usage.get("output_tokens"), latency_ms=latency, raw_stop_reason=payload.get("stop_reason"))


class OpenAICompatibleProvider(_HttpProvider):
    name = "openai_compatible"

    def __init__(self, settings: Settings, *, transport: httpx.BaseTransport | None = None) -> None:
        super().__init__(settings, transport=transport)
        assert settings.ai_base_url
        self._base = settings.ai_base_url.rstrip("/")

    def complete_structured(self, *, system: str, user: str, schema_name: str, schema: dict[str, Any], max_output_tokens: int) -> ProviderResult:
        body = {
            "model": self.model,
            "max_tokens": max_output_tokens,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_schema", "json_schema": {"name": schema_name, "schema": schema, "strict": False}},
        }
        headers = {"authorization": f"Bearer {self._key}", "content-type": "application/json"}
        payload, latency = self._post(f"{self._base}/chat/completions", headers=headers, body=body)
        try:
            message = payload["choices"][0]["message"]
            content = message.get("content")
            data = json.loads(content) if isinstance(content, str) else content
        except (KeyError, IndexError, TypeError, ValueError):
            raise AIInvalidOutputError() from None
        if not isinstance(data, dict):
            raise AIInvalidOutputError()
        usage = payload.get("usage") or {}
        return ProviderResult(data=data, model=str(payload.get("model") or self.model), input_tokens=usage.get("prompt_tokens"),
                              output_tokens=usage.get("completion_tokens"), latency_ms=latency,
                              raw_stop_reason=(payload["choices"][0].get("finish_reason") if payload.get("choices") else None))


def build_provider(settings: Settings, *, transport: httpx.BaseTransport | None = None) -> AIProvider:
    if settings.ai_provider == "anthropic":
        return AnthropicProvider(settings, transport=transport)
    if settings.ai_provider == "openai_compatible":
        return OpenAICompatibleProvider(settings, transport=transport)
    raise AIDisabledError()
