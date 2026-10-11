"""Password hashing, opaque tokens, CSRF tokens and rate limiting.

* Passwords: Argon2id (argon2-cffi defaults: 64 MiB memory, 3 iterations, 4 lanes), with
  transparent re-hashing when parameters change.
* Session / invitation tokens: 256-bit random values. Only their SHA-256 digest is stored, so a
  database leak does not yield usable tokens.
* CSRF: synchronizer token = HMAC-SHA256(SECRET_KEY, session token digest). It is bound to the
  session, returned in the login / ``/auth/me`` body (not a cookie), and must be echoed in the
  ``X-CSRF-Token`` header on every state-changing request.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import logging
import time
from collections import deque

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

_hasher = PasswordHasher()  # Argon2id
# Pre-computed hash used to spend the same time when an email is unknown (no user enumeration by timing).
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    """Constant-work check; verifies against a dummy hash when the user does not exist."""
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def csrf_token_for(signing_key: bytes, session_token_digest: str) -> str:
    return hmac.new(signing_key, f"csrf:{session_token_digest}".encode(), hashlib.sha256).hexdigest()


def csrf_matches(signing_key: bytes, session_token_digest: str, presented: str | None) -> bool:
    return bool(presented) and hmac.compare_digest(csrf_token_for(signing_key, session_token_digest), presented or "")


def password_problems(password: str, *, min_length: int, email: str | None = None, name: str | None = None) -> list[str]:
    """Length-first policy (NIST SP 800-63B style): no composition rules, but reject trivial passwords."""
    problems: list[str] = []
    if len(password) < min_length:
        problems.append(f"Password must be at least {min_length} characters long")
    if len(password) > 256:
        problems.append("Password must be at most 256 characters long")
    lowered = password.lower()
    if len(set(password)) < 5:
        problems.append("Password is too repetitive")
    for value in filter(None, [email and email.split("@")[0], name]):
        if len(value) >= 4 and value.lower() in lowered:
            problems.append("Password must not contain your name or email")
            break
    if lowered in {"password1234", "instaboard123", "qwertyuiop12", "123456789012"}:
        problems.append("Password is too common")
    return problems


_rl_logger = logging.getLogger("instaboard.ratelimit")


class RateLimiter:
    """In-process sliding-window limiter (per key). Suitable for a single API instance; a multi-instance
    deployment must back this with a shared store (e.g. Redis) or rate-limit at the reverse proxy."""

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, *, limit: int, window_seconds: float) -> tuple[bool, int]:
        """Records an event. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        with self._lock:
            events = self._events.setdefault(key, deque())
            while events and events[0] <= now - window_seconds:
                events.popleft()
            if len(events) >= limit:
                return False, max(1, int(events[0] + window_seconds - now) + 1)
            events.append(now)
            return True, 0

    def count(self, key: str, *, window_seconds: float) -> int:
        now = time.monotonic()
        with self._lock:
            events = self._events.get(key, deque())
            return sum(1 for t in events if t > now - window_seconds)

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._events.clear()
            else:
                self._events.pop(key, None)


class RedisRateLimiter:
    """Sliding-window limiter shared by every API process/replica (Redis sorted sets). Same interface as
    ``RateLimiter``. If Redis is unreachable it falls back to a per-process limiter (logged) rather than failing
    every login — limits then apply per process until Redis is back."""

    def __init__(self, client, *, prefix: str = "instaboard:rl:") -> None:
        self._redis = client
        self._prefix = prefix
        self._fallback = RateLimiter()

    def _key(self, key: str) -> str:
        return self._prefix + key

    def hit(self, key: str, *, limit: int, window_seconds: float) -> tuple[bool, int]:
        try:
            now = time.time()
            k = self._key(key)
            pipe = self._redis.pipeline()
            pipe.zremrangebyscore(k, 0, now - window_seconds)
            pipe.zcard(k)
            pipe.zrange(k, 0, 0, withscores=True)
            _, count, oldest = pipe.execute()
            if count >= limit:
                first = oldest[0][1] if oldest else now
                return False, max(1, int(first + window_seconds - now) + 1)
            pipe = self._redis.pipeline()
            pipe.zadd(k, {f"{now}:{secrets.token_hex(4)}": now})
            pipe.expire(k, int(window_seconds) + 1)
            pipe.execute()
            return True, 0
        except Exception as exc:  # noqa: BLE001
            _rl_logger.warning("Redis rate limiter unavailable (%s); using per-process limits", exc.__class__.__name__)
            return self._fallback.hit(key, limit=limit, window_seconds=window_seconds)

    def count(self, key: str, *, window_seconds: float) -> int:
        try:
            now = time.time()
            k = self._key(key)
            self._redis.zremrangebyscore(k, 0, now - window_seconds)
            return int(self._redis.zcard(k))
        except Exception as exc:  # noqa: BLE001
            _rl_logger.warning("Redis rate limiter unavailable (%s); using per-process limits", exc.__class__.__name__)
            return self._fallback.count(key, window_seconds=window_seconds)

    def reset(self, key: str | None = None) -> None:
        try:
            if key is None:
                for k in self._redis.scan_iter(match=self._prefix + "*"):
                    self._redis.delete(k)
            else:
                self._redis.delete(self._key(key))
        except Exception:  # noqa: BLE001
            pass
        self._fallback.reset(key)


def build_rate_limiter(redis_url: str | None):
    """Shared Redis limiter when REDIS_URL is configured, else the in-process limiter."""
    if not redis_url:
        return RateLimiter()
    import redis

    client = redis.Redis.from_url(redis_url, socket_timeout=0.5, socket_connect_timeout=0.5)
    return RedisRateLimiter(client)
