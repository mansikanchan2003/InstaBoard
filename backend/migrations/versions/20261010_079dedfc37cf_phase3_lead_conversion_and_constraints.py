"""Phase 3: idempotent comment → lead conversion and lead constraints.

* leads.source_comment_id (unique, FK comments.id ON DELETE SET NULL): a retried conversion of the
  same comment cannot create a second lead.
* Lead handles become unique case-insensitively (lower(handle)) instead of case-sensitively.
* Index on comments.lead_id for "comments linked to this lead" lookups.

Revision ID: 079dedfc37cf
Revises: 543a53a82c49
Create Date: 2026-10-10 23:34:44.225403

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '079dedfc37cf'
down_revision: Union[str, None] = '543a53a82c49'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(op.f('ix_comments_lead_id'), 'comments', ['lead_id'], unique=False)
    op.add_column('leads', sa.Column('source_comment_id', sa.String(length=80), nullable=True))
    op.drop_constraint('uq_leads_handle', 'leads', type_='unique')
    op.create_index('uq_leads_handle_lower', 'leads', [sa.text('lower(handle)')], unique=True)
    op.create_unique_constraint(op.f('uq_leads_source_comment_id'), 'leads', ['source_comment_id'])
    op.create_foreign_key(op.f('fk_leads_source_comment_id_comments'), 'leads', 'comments', ['source_comment_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint(op.f('fk_leads_source_comment_id_comments'), 'leads', type_='foreignkey')
    op.drop_constraint(op.f('uq_leads_source_comment_id'), 'leads', type_='unique')
    op.drop_index('uq_leads_handle_lower', table_name='leads')
    op.create_unique_constraint('uq_leads_handle', 'leads', ['handle'])
    op.drop_column('leads', 'source_comment_id')
    op.drop_index(op.f('ix_comments_lead_id'), table_name='comments')
