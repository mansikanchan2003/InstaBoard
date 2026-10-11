"""Phase 4: authentication, sessions, invitations and workspace isolation.

* users (Argon2id hashes only), auth_sessions (sha256 token hashes, idle + absolute expiry,
  revocation) and invitations (admin-provisioned onboarding).
* team_members.user_id links memberships to accounts; the demo-only is_session_user flag is removed.
* workspace_id (NOT NULL, FK, indexed) on every directly-queried tenant table, backfilled from the
  owning Instagram account / campaign / insight, or the development workspace for rows with no
  relational path (refuses to guess when several workspaces exist).
* Workspace-specific documents move from reference_documents to workspace_documents.
* Campaign/report codes, comment refs and lead handles become unique per workspace.

Revision ID: b126a04be743
Revises: 079dedfc37cf
Create Date: 2026-10-11 11:53:01.627079

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b126a04be743'
down_revision: Union[str, None] = '079dedfc37cf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TENANT_TABLES = (
    'activity_events', 'campaigns', 'comment_period_summaries', 'comment_sentiment_daily', 'comments', 'content_items',
    'insights', 'leads', 'notifications', 'recommended_actions', 'reports', 'sync_logs',
)
WORKSPACE_DOC_KEYS = ('insights_overview', 'executive_brief', 'accounts_summary', 'activity_meta', 'report_reference')

GUARD_SQL = """
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM workspaces;
  IF n > 1 AND (EXISTS (SELECT 1 FROM insights) OR EXISTS (SELECT 1 FROM notifications)
                OR EXISTS (SELECT 1 FROM activity_events WHERE account_id IS NULL)) THEN
    RAISE EXCEPTION 'Phase 4 backfill: several workspaces exist; set workspace_id on insights/notifications/activity_events manually first';
  END IF;
END $$;
"""


def upgrade() -> None:
    op.create_table('users',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('name', sa.String(length=160), nullable=False),
    sa.Column('password_hash', sa.Text(), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('is_platform_admin', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("password_hash LIKE '$argon2%%'", name=op.f('ck_users_argon2_hash')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    op.create_index('uq_users_email_lower', 'users', [sa.text('lower(email)')], unique=True)
    op.create_table('auth_sessions',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.String(length=64), nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('idle_expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('absolute_expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revoked_reason', sa.String(length=40), nullable=True),
    sa.Column('user_agent', sa.String(length=300), nullable=True),
    sa.Column('ip_address', sa.String(length=64), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_auth_sessions_user_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_auth_sessions_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_auth_sessions')),
    sa.UniqueConstraint('token_hash', name=op.f('uq_auth_sessions_token_hash'))
    )
    op.create_index('ix_auth_sessions_user_active', 'auth_sessions', ['user_id', 'revoked_at'], unique=False)
    op.create_index(op.f('ix_auth_sessions_user_id'), 'auth_sessions', ['user_id'], unique=False)
    op.create_table('workspace_documents',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('key', sa.String(length=80), nullable=False),
    sa.Column('document', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_workspace_documents_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workspace_documents')),
    sa.UniqueConstraint('workspace_id', 'key', name=op.f('uq_workspace_documents_workspace_id_key'))
    )
    op.create_index(op.f('ix_workspace_documents_workspace_id'), 'workspace_documents', ['workspace_id'], unique=False)
    op.create_table('invitations',
    sa.Column('id', sa.String(length=40), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('workspace_id', sa.String(length=64), nullable=False),
    sa.Column('member_id', sa.String(length=80), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('access', sa.Enum('Owner', 'Admin', 'Editor', 'Viewer', name='invitation_access', native_enum=False, create_constraint=True, length=14), nullable=False),
    sa.Column('invited_by_member_id', sa.String(length=80), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['invited_by_member_id'], ['team_members.id'], name=op.f('fk_invitations_invited_by_member_id_team_members'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['member_id'], ['team_members.id'], name=op.f('fk_invitations_member_id_team_members'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], name=op.f('fk_invitations_workspace_id_workspaces'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_invitations')),
    sa.UniqueConstraint('member_id', name=op.f('uq_invitations_member_id')),
    sa.UniqueConstraint('token_hash', name=op.f('uq_invitations_token_hash'))
    )
    op.create_index(op.f('ix_invitations_workspace_id'), 'invitations', ['workspace_id'], unique=False)

    # --- workspace_id on tenant tables: add nullable -> backfill -> NOT NULL + FK + index ---------
    for table in TENANT_TABLES:
        op.add_column(table, sa.Column('workspace_id', sa.String(length=64), nullable=True))

    # Rows linked to an Instagram account inherit that account's workspace.
    for table in ('campaigns', 'content_items', 'comments', 'reports', 'sync_logs', 'comment_period_summaries', 'comment_sentiment_daily'):
        op.execute(f"UPDATE {table} t SET workspace_id = a.workspace_id FROM instagram_accounts a WHERE a.id = t.account_id")
    op.execute("UPDATE activity_events t SET workspace_id = a.workspace_id FROM instagram_accounts a WHERE a.id = t.account_id")
    op.execute("UPDATE leads t SET workspace_id = c.workspace_id FROM campaigns c WHERE c.id = t.campaign_id")
    # Rows with no relational path (insights, notifications, account-less activity) belong to the
    # development workspace. Refuse to guess when several workspaces already exist.
    op.execute(GUARD_SQL)
    for table in ('insights', 'notifications', 'activity_events'):
        op.execute(f"UPDATE {table} SET workspace_id = (SELECT id FROM workspaces ORDER BY created_at, id LIMIT 1) WHERE workspace_id IS NULL")
    op.execute("UPDATE recommended_actions t SET workspace_id = i.workspace_id FROM insights i WHERE i.id = t.insight_id")

    for table in TENANT_TABLES:
        op.alter_column(table, 'workspace_id', nullable=False)
        op.create_index(op.f(f'ix_{table}_workspace_id'), table, ['workspace_id'], unique=False)
        op.create_foreign_key(op.f(f'fk_{table}_workspace_id_workspaces'), table, 'workspaces', ['workspace_id'], ['id'], ondelete='CASCADE')

    # --- uniqueness becomes per workspace (two tenants may reuse codes / commenters) -------------
    op.drop_constraint('uq_campaigns_code', 'campaigns', type_='unique')
    op.create_unique_constraint(op.f('uq_campaigns_workspace_id_code'), 'campaigns', ['workspace_id', 'code'])
    op.drop_constraint('uq_reports_code', 'reports', type_='unique')
    op.create_unique_constraint(op.f('uq_reports_workspace_id_code'), 'reports', ['workspace_id', 'code'])
    op.drop_constraint('uq_comments_ref', 'comments', type_='unique')
    op.create_unique_constraint(op.f('uq_comments_workspace_id_ref'), 'comments', ['workspace_id', 'ref'])
    op.drop_index('uq_leads_handle_lower', table_name='leads')
    op.create_index('uq_leads_workspace_handle_lower', 'leads', ['workspace_id', sa.text('lower(handle)')], unique=True)

    # --- workspace-specific documents move out of the global reference table ----------------------
    keys = ", ".join(repr(k) for k in WORKSPACE_DOC_KEYS)
    op.execute(
        "INSERT INTO workspace_documents (workspace_id, key, document, is_demo) "
        "SELECT w.id, r.key, r.document, r.is_demo FROM reference_documents r "
        "CROSS JOIN (SELECT id FROM workspaces ORDER BY created_at, id LIMIT 1) w "
        f"WHERE r.key IN ({keys})"
    )
    op.execute(f"DELETE FROM reference_documents WHERE key IN ({keys}, 'settings_session')")

    # --- memberships link to user accounts; the demo "session user" flag is replaced by real auth ---
    op.add_column('team_members', sa.Column('user_id', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_team_members_user_id'), 'team_members', ['user_id'], unique=False)
    op.create_index('uq_team_members_workspace_user', 'team_members', ['workspace_id', 'user_id'], unique=True,
                    postgresql_where=sa.text('user_id IS NOT NULL'))
    op.create_foreign_key(op.f('fk_team_members_user_id_users'), 'team_members', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.drop_index('uq_team_members_session_user', table_name='team_members', postgresql_where=sa.text('is_session_user'))
    op.drop_column('team_members', 'is_session_user')


def downgrade() -> None:
    op.add_column('team_members', sa.Column('is_session_user', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.execute(
        "UPDATE team_members SET is_session_user = true WHERE id IN ("
        "SELECT DISTINCT ON (workspace_id) id FROM team_members WHERE access = 'Owner' ORDER BY workspace_id, position)"
    )
    op.create_index('uq_team_members_session_user', 'team_members', ['workspace_id'], unique=True, postgresql_where=sa.text('is_session_user'))
    op.drop_constraint(op.f('fk_team_members_user_id_users'), 'team_members', type_='foreignkey')
    op.drop_index('uq_team_members_workspace_user', table_name='team_members', postgresql_where=sa.text('user_id IS NOT NULL'))
    op.drop_index(op.f('ix_team_members_user_id'), table_name='team_members')
    op.drop_column('team_members', 'user_id')

    op.execute(
        "INSERT INTO reference_documents (key, description, document, is_demo) "
        "SELECT DISTINCT ON (key) key, '', document, is_demo FROM workspace_documents ORDER BY key, id "
        "ON CONFLICT (key) DO NOTHING"
    )
    op.drop_index('uq_leads_workspace_handle_lower', table_name='leads')
    op.create_index('uq_leads_handle_lower', 'leads', [sa.text('lower(handle)')], unique=True)
    op.drop_constraint(op.f('uq_comments_workspace_id_ref'), 'comments', type_='unique')
    op.create_unique_constraint('uq_comments_ref', 'comments', ['ref'])
    op.drop_constraint(op.f('uq_reports_workspace_id_code'), 'reports', type_='unique')
    op.create_unique_constraint('uq_reports_code', 'reports', ['code'])
    op.drop_constraint(op.f('uq_campaigns_workspace_id_code'), 'campaigns', type_='unique')
    op.create_unique_constraint('uq_campaigns_code', 'campaigns', ['code'])
    for table in TENANT_TABLES:
        op.drop_constraint(op.f(f'fk_{table}_workspace_id_workspaces'), table, type_='foreignkey')
        op.drop_index(op.f(f'ix_{table}_workspace_id'), table_name=table)
        op.drop_column(table, 'workspace_id')

    op.drop_index(op.f('ix_invitations_workspace_id'), table_name='invitations')
    op.drop_table('invitations')
    op.drop_index(op.f('ix_workspace_documents_workspace_id'), table_name='workspace_documents')
    op.drop_table('workspace_documents')
    op.drop_index(op.f('ix_auth_sessions_user_id'), table_name='auth_sessions')
    op.drop_index('ix_auth_sessions_user_active', table_name='auth_sessions')
    op.drop_table('auth_sessions')
    op.drop_index('uq_users_email_lower', table_name='users')
    op.drop_table('users')
