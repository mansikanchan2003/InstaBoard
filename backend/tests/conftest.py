"""Test fixtures.

* Tests marked ``db`` need PostgreSQL at ``TEST_DATABASE_URL`` (env var or backend/.env). The
  database is rebuilt with Alembic migrations and seeded once per session; every test then runs
  inside a transaction that is rolled back, so tests never see each other's writes.
  If PostgreSQL is unreachable those tests are SKIPPED (reported as such), never silently passed.
* Unmarked tests run without a database (they point the app at an unreachable URL).
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.main import create_app
from app.models import Base
from app.seed.loader import seed_demo_data

BACKEND_DIR = Path(__file__).resolve().parents[1]
UNREACHABLE_DB = "postgresql+psycopg://nobody:nothing@127.0.0.1:1/none"


def _dotenv_value(key: str) -> str | None:
    env_file = BACKEND_DIR / ".env"
    if not env_file.exists():
        return None
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or _dotenv_value("TEST_DATABASE_URL")


def make_settings(database_url: str, **overrides) -> Settings:
    return Settings(_env_file=None, database_url=database_url, app_env="test", **overrides)  # type: ignore[call-arg]


def alembic_config(url: str) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.attributes["skip_logging_config"] = True
    os.environ["ALEMBIC_DATABASE_URL"] = url
    return cfg


def reset_schema(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))


def migrate_and_seed(engine: Engine, url: str) -> None:
    reset_schema(engine)
    command.upgrade(alembic_config(url), "head")
    with Session(engine) as session, session.begin():
        seed_demo_data(session)


# ------------------------------------------------------------------------------- no database
@pytest.fixture
def offline_client() -> Iterator[TestClient]:
    """App wired to an unreachable database — for tests that must not need PostgreSQL."""
    app = create_app(make_settings(UNREACHABLE_DB))
    with TestClient(app) as client:
        yield client


# ---------------------------------------------------------------------------------- database
@pytest.fixture(scope="session")
def db_url() -> str:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is not configured — PostgreSQL tests not run")
    return TEST_DATABASE_URL


@pytest.fixture(scope="session")
def engine(db_url: str) -> Iterator[Engine]:
    eng = create_engine(db_url, connect_args={"connect_timeout": 3})
    try:
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"PostgreSQL at TEST_DATABASE_URL is unreachable ({exc.__class__.__name__}) — database tests not run")
    migrate_and_seed(eng, db_url)
    yield eng
    eng.dispose()


@pytest.fixture
def connection(engine: Engine):
    """One connection + outer transaction per test; rolled back afterwards."""
    conn = engine.connect()
    outer = conn.begin()
    try:
        yield conn
    finally:
        outer.rollback()
        conn.close()


@pytest.fixture
def db_session(connection) -> Iterator[Session]:
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(connection, db_url: str) -> Iterator[TestClient]:
    app = create_app(make_settings(db_url))
    # Requests share the test transaction; their commits become savepoints that are rolled back.
    app.state.session_factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def empty_client(connection, client: TestClient) -> TestClient:
    """Same as ``client`` but every table is emptied (inside the rolled-back transaction)."""
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    connection.execute(text(f"TRUNCATE {tables} CASCADE"))
    return client


def api(path: str) -> str:
    return f"/api/v1{path}"
