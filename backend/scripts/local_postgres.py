"""Run a private, development-only PostgreSQL cluster without Docker.

Uses the PostgreSQL binaries already installed on the machine (initdb / pg_ctl) and keeps the
data directory inside ``backend/.pgdata`` on its own port, so it never touches another
PostgreSQL service or its credentials.

    python -m scripts.local_postgres init     # one-time: create cluster + role + databases
    python -m scripts.local_postgres start
    python -m scripts.local_postgres status
    python -m scripts.local_postgres stop

Configuration (environment variables or backend/.env):
    LOCAL_PG_PORT      default 5544
    LOCAL_PG_USER      default instaboard
    LOCAL_PG_PASSWORD  required for ``init`` (local development password, never commit it)
    PG_BIN             optional directory containing pg_ctl / initdb
Docker users can use ``docker compose up -d db`` instead (see README).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / ".pgdata"
LOG_FILE = BACKEND_DIR / ".pgdata.log"


def _load_dotenv() -> None:
    env_file = BACKEND_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _bin(name: str) -> str:
    exe = f"{name}.exe" if os.name == "nt" else name
    if pg_bin := os.environ.get("PG_BIN"):
        return str(Path(pg_bin) / exe)
    if found := shutil.which(name):
        return found
    if os.name == "nt":
        for base in sorted(Path("C:/Program Files/PostgreSQL").glob("*/bin"), reverse=True):
            if (base / exe).exists():
                return str(base / exe)
    sys.exit(f"Could not find {name}. Install PostgreSQL or set PG_BIN to its bin directory.")


def _port() -> str:
    return os.environ.get("LOCAL_PG_PORT", "5544")


def _user() -> str:
    return os.environ.get("LOCAL_PG_USER", "instaboard")


def _run(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=False, text=True, capture_output=True, **kwargs)


def init() -> None:
    if DATA_DIR.exists():
        print(f"Cluster already initialised at {DATA_DIR}")
        return
    password = os.environ.get("LOCAL_PG_PASSWORD")
    if not password:
        sys.exit("Set LOCAL_PG_PASSWORD (e.g. in backend/.env) before running init.")
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".pw", encoding="utf-8") as fh:
        fh.write(password)
        pwfile = fh.name
    try:
        result = _run([
            _bin("initdb"), "-D", str(DATA_DIR), "-U", _user(), "--pwfile", pwfile,
            "--auth-local=scram-sha-256", "--auth-host=scram-sha-256", "-E", "UTF8", "--locale=C",
        ])
    finally:
        os.unlink(pwfile)
    if result.returncode != 0:
        sys.exit(result.stderr or result.stdout)
    # Listen on localhost only.
    with (DATA_DIR / "postgresql.conf").open("a", encoding="utf-8") as conf:
        conf.write(f"\nlisten_addresses = 'localhost'\nport = {_port()}\ntimezone = 'UTC'\n")
    start()
    create_databases()


def create_databases() -> None:
    """Create the app + test databases if they do not exist (idempotent)."""
    password = os.environ.get("LOCAL_PG_PASSWORD")
    if not password:
        sys.exit("Set LOCAL_PG_PASSWORD (e.g. in backend/.env).")
    env = {**os.environ, "PGPASSWORD": password}
    for db in ("instaboard", "instaboard_test"):
        created = _run([_bin("createdb"), "-h", "localhost", "-p", _port(), "-U", _user(), db], env=env)
        message = "created" if created.returncode == 0 else ("exists" if "already exists" in created.stderr else created.stderr.strip())
        print(f"database {db}: {message}")


def start() -> None:
    if not DATA_DIR.exists():
        sys.exit("No cluster yet — run `python -m scripts.local_postgres init` first.")
    # Do not capture output: on Windows the server process inherits the pipes and the call never returns.
    result = subprocess.run(
        [_bin("pg_ctl"), "-D", str(DATA_DIR), "-l", str(LOG_FILE), "-w", "start"],
        check=False, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print("server started" if result.returncode == 0 else f"pg_ctl start failed (see {LOG_FILE})")


def stop() -> None:
    result = _run([_bin("pg_ctl"), "-D", str(DATA_DIR), "-w", "stop"])
    print((result.stdout or result.stderr).strip())


def status() -> None:
    result = _run([_bin("pg_ctl"), "-D", str(DATA_DIR), "status"])
    print((result.stdout or result.stderr).strip())


def main() -> None:
    _load_dotenv()
    commands = {"init": init, "create-dbs": create_databases, "start": start, "stop": stop, "status": status}
    if len(sys.argv) != 2 or sys.argv[1] not in commands:
        sys.exit(f"usage: python -m scripts.local_postgres [{'|'.join(commands)}]")
    commands[sys.argv[1]]()


if __name__ == "__main__":
    main()
