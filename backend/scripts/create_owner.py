"""Create (or reset) the Owner account of a workspace — admin-provisioned onboarding.

    python -m scripts.create_owner --email owner@example.com --name "Priya Sharma"
    python -m scripts.create_owner --email priya.sharma@eko.example --member usr-priya     # link the seeded owner

The password is read from a hidden prompt (or the INSTABOARD_OWNER_PASSWORD environment variable for
automation). It is never accepted as a command-line argument, printed or logged.
Everyone else joins through invitations created in Settings → Workspace & Team.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from app.core.config import get_settings
from app.core.database import build_engine, build_session_factory
from app.core.errors import ApiError
from app.services.auth import provision_owner


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default=None, help="display name (defaults to the linked member's name)")
    parser.add_argument("--workspace", default="ws-eko-india", help="workspace id (default: the seeded development workspace)")
    parser.add_argument("--member", default=None, help="existing team_members.id to link (default: the workspace's Owner member)")
    parser.add_argument("--platform-admin", action="store_true", help="also mark the account as an InstaBoard platform administrator")
    args = parser.parse_args()

    settings = get_settings()
    password = os.environ.get("INSTABOARD_OWNER_PASSWORD")
    if not password:
        password = getpass.getpass("New password: ")
        if password != getpass.getpass("Repeat password: "):
            print("Passwords do not match.", file=sys.stderr)
            return 1

    factory = build_session_factory(build_engine(settings))
    with factory() as db, db.begin():
        name = args.name
        if not name and args.member:
            from app.models import TeamMember

            member = db.get(TeamMember, args.member)
            name = member.name if member else None
        try:
            user, member = provision_owner(db, workspace_id=args.workspace, email=args.email, name=name or args.email.split("@")[0],
                                           password=password, min_length=settings.min_password_length, member_id=args.member)
        except ApiError as exc:
            print(f"Error: {exc.message}", file=sys.stderr)
            return 1
        if args.platform_admin:
            user.is_platform_admin = True
        print(f"Owner ready: {user.email} -> workspace {member.workspace_id} (member {member.id}). Sign in at the web app.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
