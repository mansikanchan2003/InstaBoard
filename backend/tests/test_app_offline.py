"""Startup, configuration, error format, CORS and validation — no database required."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings

from .conftest import UNREACHABLE_DB, api, make_settings


def test_health_does_not_need_the_database(offline_client):
    response = offline_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "environment": "test"}


def test_ready_reports_unavailable_database_without_leaking_details(offline_client):
    response = offline_client.get("/ready")
    assert response.status_code == 503
    body = response.json()
    assert body == {"status": "unavailable", "checks": {"database": "unreachable"}}
    assert "nobody" not in response.text and "127.0.0.1" not in response.text


def test_database_errors_return_structured_503(offline_client):
    response = offline_client.get(api("/campaigns"))
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "database_unavailable"
    assert "nothing" not in response.text  # password from the URL is never echoed


def test_unknown_endpoint_uses_error_envelope(offline_client):
    response = offline_client.get(api("/does-not-exist"))
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Endpoint not found", "details": None}}


@pytest.mark.parametrize(
    ("path", "param"),
    [
        ("/campaigns?status=launched", "status"),
        ("/leads?status=unknown", "status"),
        ("/content?type=video", "type"),
        ("/comments?sentiment=angry", "sentiment"),
        ("/activity?limit=0", "limit"),
        ("/accounts/sync-logs?offset=-1", "offset"),
        ("/notifications?unread=maybe", "unread"),
    ],
)
def test_invalid_query_parameters_are_rejected(offline_client, path, param):
    response = offline_client.get(api(path))
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "validation_error"
    assert any(param in detail["location"] for detail in body["details"])


def test_invalid_path_parameter_is_rejected(offline_client):
    response = offline_client.get(api("/campaigns/bad id!"))
    assert response.status_code == 422


def test_invalid_body_is_rejected_before_touching_the_database(offline_client):
    response = offline_client.post(api("/campaigns"), json={"name": "x", "objective": "Sales", "status": "active"})
    assert response.status_code == 422
    fields = {tuple(d["location"]) for d in response.json()["error"]["details"]}
    assert ("body", "name") in fields and ("body", "objective") in fields and ("body", "status") in fields


def test_cors_allows_configured_origin(offline_client):
    response = offline_client.options(
        api("/campaigns"), headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"}
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_rejects_unknown_origin(offline_client):
    response = offline_client.options(
        api("/campaigns"), headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"}
    )
    assert "access-control-allow-origin" not in response.headers


def test_openapi_documents_the_api(offline_client):
    schema = offline_client.get("/openapi.json").json()
    assert "/api/v1/campaigns" in schema["paths"]
    assert "/api/v1/campaigns/{campaign_id}" in schema["paths"]
    assert len(schema["paths"]) >= 50


def test_docs_can_be_disabled():
    from fastapi.testclient import TestClient

    from app.main import create_app

    client = TestClient(create_app(make_settings(UNREACHABLE_DB, enable_docs=False)))
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


# ------------------------------------------------------------------------------ configuration
def test_database_url_is_required(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError) as exc:
        Settings(_env_file=None)  # type: ignore[call-arg]
    assert "database_url" in str(exc.value)


def test_database_url_must_use_psycopg_driver():
    with pytest.raises(ValidationError, match="psycopg"):
        make_settings("postgresql://user:pw@localhost:5432/db")


def test_wildcard_cors_origin_is_rejected():
    with pytest.raises(ValidationError, match="explicit origins"):
        make_settings(UNREACHABLE_DB, cors_origins="*")


def test_cors_origins_parse_from_comma_separated_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", UNREACHABLE_DB)
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test, http://b.test")
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.cors_origins == ["http://a.test", "http://b.test"]


def test_invalid_app_env_is_rejected():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url=UNREACHABLE_DB, app_env="staging")  # type: ignore[call-arg]
