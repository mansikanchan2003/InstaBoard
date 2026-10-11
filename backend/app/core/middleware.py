"""HTTP hardening middleware (pure ASGI, so streaming bodies are handled correctly).

* ``RequestContextMiddleware`` — assigns/propagates ``X-Request-ID`` (accepts a safe incoming value, else generates
  one), exposes it on the response and logs one structured line per request (method, path without query string,
  status, duration). Query strings are never logged.
* ``BodySizeLimitMiddleware`` — rejects request bodies over ``MAX_REQUEST_BYTES`` with 413, both when
  ``Content-Length`` is declared and when a chunked body grows past the limit.
* ``SecurityHeadersMiddleware`` — conservative headers for a JSON API: no sniffing, no framing, no referrer,
  ``Cache-Control: no-store`` on API responses, a deny-all CSP on JSON (relaxed only for the optional /docs UI),
  and HSTS when served over HTTPS (``COOKIE_SECURE=true``). The frontend's own headers are set by nginx.
"""

from __future__ import annotations

import json
import logging
import re
import secrets
import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .logging import request_id_var

logger = logging.getLogger("instaboard.request")
_SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        incoming = dict(scope.get("headers") or []).get(b"x-request-id", b"").decode("latin-1")
        request_id = incoming if _SAFE_ID.match(incoming) else secrets.token_hex(8)
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status_holder = {"status": 500}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                headers = list(message.get("headers") or [])
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration = round((time.perf_counter() - started) * 1000, 1)
            path = scope.get("path", "")
            if path not in ("/health",):  # liveness probes would flood the log
                level = logging.WARNING if status_holder["status"] >= 500 else logging.INFO
                logger.log(level, "%s %s %s %sms", scope.get("method"), path, status_holder["status"], duration,
                           extra={"method": scope.get("method"), "path": path, "status": status_holder["status"], "duration_ms": duration})
            request_id_var.reset(token)


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, *, max_bytes: int) -> None:
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = dict(scope.get("headers") or []).get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_bytes:
            await _too_large(send, self.max_bytes)
            return
        received = 0
        responded = False

        async def tracking_send(message: Message) -> None:
            if responded:
                return  # we already answered 413; drop whatever the app tries to send afterwards
            await send(message)

        async def limited_receive() -> Message:
            nonlocal received, responded
            if responded:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    # Answer 413 ourselves (frameworks turn body-read errors into their own 400) and end the request.
                    await _too_large(send, self.max_bytes)
                    responded = True
                    return {"type": "http.disconnect"}
            return message

        try:
            await self.app(scope, limited_receive, tracking_send)
        except RequestBodyTooLarge:
            if not responded:
                await _too_large(send, self.max_bytes)


class RequestBodyTooLarge(Exception):
    """Raised while a handler reads an oversized body; mapped to 413 by ``app.core.errors``."""

    def __init__(self, limit: int) -> None:
        super().__init__(limit)
        self.limit = limit


async def _too_large(send: Send, limit: int) -> None:
    body = json.dumps({"error": {"code": "payload_too_large", "message": f"Request body exceeds the {limit}-byte limit.", "details": None}}).encode()
    await send({"type": "http.response.start", "status": 413, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, *, hsts: bool) -> None:
        self.app, self.hsts = app, hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope.get("path", "")
        docs = path in ("/docs", "/redoc") or path.startswith("/docs/")

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = [(k, v) for k, v in (message.get("headers") or []) if k.lower() not in _MANAGED]
                headers += [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"cross-origin-opener-policy", b"same-origin"),
                    (b"cross-origin-resource-policy", b"same-site"),
                    (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=()"),
                ]
                if not docs:
                    headers.append((b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"))
                if path.startswith("/api/") and not any(k.lower() == b"cache-control" for k, _ in headers):
                    headers.append((b"cache-control", b"no-store"))
                if self.hsts:
                    headers.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


_MANAGED = {b"x-content-type-options", b"x-frame-options", b"referrer-policy", b"cross-origin-opener-policy",
            b"cross-origin-resource-policy", b"permissions-policy", b"content-security-policy", b"strict-transport-security"}
