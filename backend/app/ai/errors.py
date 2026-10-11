"""AI error taxonomy. Messages are safe to show users: no prompts, keys or raw provider payloads."""

from __future__ import annotations


class AIError(Exception):
    category = "ai_error"
    retryable = False
    message = "The AI request failed."

    def __init__(self, message: str | None = None, *, retry_after: float | None = None) -> None:
        super().__init__(message or self.message)
        self.safe_message = message or self.message
        self.retry_after = retry_after


class AIDisabledError(AIError):
    category = "ai_disabled"
    message = "AI features are not configured on this server (AI_PROVIDER=none)."


class AIBudgetExceededError(AIError):
    category = "budget_exceeded"
    message = "This workspace reached its AI usage limit for the period. Deterministic analytics remain available."


class AIRateLimitedError(AIError):
    category = "rate_limited"
    retryable = True
    message = "The AI provider is rate-limiting requests. The job will retry later."


class AITimeoutError(AIError):
    category = "timeout"
    retryable = True
    message = "The AI provider did not respond in time."


class AIProviderUnavailableError(AIError):
    category = "provider_unavailable"
    retryable = True
    message = "The AI provider is temporarily unavailable."


class AIAuthError(AIError):
    category = "provider_auth"
    message = "The AI provider rejected the server's credentials or model configuration. An administrator must check AI_API_KEY / AI_MODEL."


class AIInvalidOutputError(AIError):
    category = "invalid_output"
    retryable = True  # a fresh sample may well be valid; bounded by the retry limit
    message = "The AI response did not match the required structure and was discarded."


class AIRequestError(AIError):
    category = "provider_rejected"
    message = "The AI provider rejected the request."
