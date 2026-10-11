"""Structured API errors.

Every error response has the same body:

    {"error": {"code": "not_found", "message": "Campaign 'x' was not found", "details": null}}

Internal exception details (stack traces, SQL, connection strings) are never sent to clients;
they are logged server-side instead.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("instaboard.api")


class ApiError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "bad_request"

    def __init__(self, message: str, *, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(ApiError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"

    def __init__(self, entity: str, entity_id: str) -> None:
        super().__init__(f"{entity} '{entity_id}' was not found", details={"entity": entity, "id": entity_id})


class UnprocessableError(ApiError):
    """Well-formed request that fails a business rule (e.g. end date before start date)."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "validation_error"


class ConflictError(ApiError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class NotImplementedInPhaseError(ApiError):
    """Feature exists in the UI but needs an integration that this phase deliberately does not have."""

    status_code = status.HTTP_501_NOT_IMPLEMENTED
    code = "not_available"


def _body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_body(exc.code, exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"location": list(err.get("loc", ())), "message": err.get("msg", "Invalid value"), "type": err.get("type")}
            for err in exc.errors()
        ]
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=_body("validation_error", "Request validation failed", details))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        message = "Endpoint not found" if exc.status_code == 404 else str(exc.detail)
        return JSONResponse(status_code=exc.status_code, content=_body(code, message), headers=getattr(exc, "headers", None))

    @app.exception_handler(OperationalError)
    async def _db_unavailable(_: Request, exc: OperationalError) -> JSONResponse:
        logger.error("Database unavailable: %s", exc.__class__.__name__)
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=_body("database_unavailable", "The database is not reachable"))

    @app.exception_handler(SQLAlchemyError)
    async def _db_error(_: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.exception("Database error")
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=_body("internal_error", "An internal error occurred"))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error")
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=_body("internal_error", "An internal error occurred"))
