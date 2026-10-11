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


DEV_WORKSPACE = "ws-eko-india"
TEST_PASSWORD = "correct-horse-battery-staple-42"
# Seeded (already active) members that get login accounts in the test database: member id → role.
# Viewer accounts are created per test (see ``viewer_client``) so the seeded team list stays unchanged.
TEST_ACCOUNTS = {"usr-priya": "Owner", "usr-rahul": "Admin", "usr-ananya": "Editor"}


def migrate_and_seed(engine: Engine, url: str) -> None:
    reset_schema(engine)
    command.upgrade(alembic_config(url), "head")
    with Session(engine) as session, session.begin():
        seed_demo_data(session)
        provision_test_accounts(session)


def provision_test_accounts(session: Session) -> None:
    """Login accounts for the seeded Owner, Admin and Editor members."""
    from app.models import TeamMember, User
    from app.services.auth import hash_password

    hashed = hash_password(TEST_PASSWORD)
    for member_id in TEST_ACCOUNTS:
        member = session.get(TeamMember, member_id)
        user = User(id=f"usr_test_{member_id}", email=member.email, name=member.name, password_hash=hashed)
        session.add(user)
        session.flush()
        member.user_id = user.id


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


def make_app(connection, db_url: str):
    app = create_app(make_settings(db_url))
    # Requests share the test transaction; their commits become savepoints that are rolled back.
    app.state.session_factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    return app


def sign_in(app, client: TestClient, connection, *, user_id: str, workspace_id: str = DEV_WORKSPACE) -> TestClient:
    """Creates a real server-side session (as /auth/login would) and installs its cookie + CSRF header."""
    from app.core.security import csrf_token_for
    from app.models import User
    from app.services.auth import _new_session

    settings = app.state.settings
    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        token, session = _new_session(s, settings, s.get(User, user_id), workspace_id, user_agent="pytest", ip="testclient")
        digest = session.token_hash
        s.commit()
    client.cookies.set(settings.session_cookie_name, token)
    client.headers["X-CSRF-Token"] = csrf_token_for(settings.signing_key, digest)
    return client


@pytest.fixture
def client(connection, db_url: str) -> Iterator[TestClient]:
    """Signed in as Priya Sharma, Owner of the development workspace."""
    app = make_app(connection, db_url)
    with TestClient(app) as test_client:
        yield sign_in(app, test_client, connection, user_id="usr_test_usr-priya")


@pytest.fixture
def anon_client(connection, db_url: str) -> Iterator[TestClient]:
    with TestClient(make_app(connection, db_url)) as test_client:
        yield test_client


@pytest.fixture
def client_as(connection, db_url: str):
    """Factory: ``client_as("usr-rahul")`` → a client signed in as that seeded member's account."""
    opened: list[TestClient] = []

    def _make(member_id: str, workspace_id: str = DEV_WORKSPACE, user_id: str | None = None) -> TestClient:
        app = make_app(connection, db_url)
        test_client = TestClient(app)
        test_client.__enter__()
        opened.append(test_client)
        return sign_in(app, test_client, connection, user_id=user_id or f"usr_test_{member_id}", workspace_id=workspace_id)

    yield _make
    for c in opened:
        c.__exit__(None, None, None)


@pytest.fixture
def empty_client(connection, client: TestClient) -> TestClient:
    """Signed-in client whose workspace exists but holds no data (inside the rolled-back transaction).
    Identity rows (workspace, memberships, users, sessions) are kept — you cannot be signed in without them."""
    keep = {"workspaces", "team_members", "users", "auth_sessions", "invitations"}
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables if t.name not in keep)
    connection.execute(text(f"TRUNCATE {tables} CASCADE"))
    return client


def api(path: str) -> str:
    return f"/api/v1{path}"


@pytest.fixture
def viewer_client(connection, client_as):
    """A Viewer member + account created inside the test transaction, signed in."""
    from app.models import TeamMember, User
    from app.services.auth import hash_password

    with Session(bind=connection, join_transaction_mode="create_savepoint") as s:
        user = User(id="usr_test_viewer", email="viewer@eko.example", name="Vani Viewer", password_hash=hash_password(TEST_PASSWORD))
        s.add(user)
        s.flush()
        s.add(TeamMember(id="usr-viewer", workspace_id=DEV_WORKSPACE, user_id=user.id, name=user.name, email=user.email, role="Analyst",
                         access="Viewer", status="active", last_active_label="Active now", position=99))
        s.commit()
    return client_as("usr-viewer", user_id="usr_test_viewer")
