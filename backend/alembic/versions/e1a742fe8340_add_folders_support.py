"""add_folders_support

Revision ID: e1a742fe8340
Revises: 9dd2e7dd1414
Create Date: 2024-01-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e1a742fe8340'
down_revision: Union[str, None] = '9dd2e7dd1414'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create chat_folders table
    op.create_table('chat_folders',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['parent_id'], ['chat_folders.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Add folder_id to chat_threads
    op.add_column('chat_threads',
        sa.Column('folder_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_chat_threads_folder_id_chat_folders',
        'chat_threads', 'chat_folders',
        ['folder_id'], ['id']
    )


def downgrade() -> None:
    # Remove folder_id from chat_threads
    op.drop_constraint(
        'fk_chat_threads_folder_id_chat_folders',
        'chat_threads',
        type_='foreignkey'
    )
    op.drop_column('chat_threads', 'folder_id')

    # Drop chat_folders table
    op.drop_table('chat_folders')
