"""add_image_url_to_chat_messages

Revision ID: 50b7bb1f9b67
Revises: standardize_timestamps
Create Date: 2025-01-26 11:02:16.425608

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '50b7bb1f9b67'
down_revision: Union[str, None] = 'standardize_timestamps'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
