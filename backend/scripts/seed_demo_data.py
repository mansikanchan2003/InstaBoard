"""Seed PostgreSQL with the InstaBoard DEMONSTRATION dataset (safe to re-run).

    python -m scripts.seed_demo_data            # insert missing demo rows only
    python -m scripts.seed_demo_data --reset    # also restore existing demo rows to their original values

Run migrations first: ``alembic upgrade head``.
The dataset is exported from the frontend (``npm run export:demo-data`` in frontend/).
"""

from __future__ import annotations

import argparse
import sys

from app.core.config import get_settings
from app.core.database import build_engine, build_session_factory
from app.seed.loader import seed_demo_data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="overwrite existing demo rows with the original demo values")
    args = parser.parse_args()

    engine = build_engine(get_settings())
    factory = build_session_factory(engine)
    with factory() as session, session.begin():
        report = seed_demo_data(session, reset=args.reset)

    width = max(len(name) for name in report.inserted)
    print(f"{'table':<{width}}  {'written':>7}  {'unchanged':>9}")
    for name in sorted(report.inserted):
        print(f"{name:<{width}}  {report.inserted[name]:>7}  {report.skipped[name]:>9}")
    mode = "reset" if args.reset else "insert-missing"
    print(f"\nDemo data seeded ({mode}): {report.total_inserted} rows written. All rows are flagged is_demo=true.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
