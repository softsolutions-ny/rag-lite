"""add_label_to_chat_threads

Revision ID: 9dd2e7dd1414
Revises: d5bce794d78e
Create Date: 2024-01-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9dd2e7dd1414'
down_revision: Union[str, None] = 'd5bce794d78e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add label column to chat_threads table
    op.add_column('chat_threads', sa.Column('label', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove label column from chat_threads table
    op.drop_column('chat_threads', 'label')
