"""add_timezone_support_to_datetime_columns

Revision ID: 6d0bacb1e048
Revises: e1a742fe8340
Create Date: 2025-01-23 15:22:36.672803

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d0bacb1e048'
down_revision: Union[str, None] = 'e1a742fe8340'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alter Image table
    op.alter_column('images', 'uploaded_at',
                    type_=sa.DateTime(timezone=True),
                    existing_type=sa.DateTime(),
                    postgresql_using='uploaded_at AT TIME ZONE \'UTC\'')
    
    # Alter ImageProcessing table
    for column in ['start_time', 'end_time', 'api_start_time', 'api_end_time']:
        op.alter_column('image_processings', column,
                       type_=sa.DateTime(timezone=True),
                       existing_type=sa.DateTime(),
                       postgresql_using=f'{column} AT TIME ZONE \'UTC\'')


def downgrade() -> None:
    # Revert Image table
    op.alter_column('images', 'uploaded_at',
                    type_=sa.DateTime(),
                    existing_type=sa.DateTime(timezone=True))
    
    # Revert ImageProcessing table
    for column in ['start_time', 'end_time', 'api_start_time', 'api_end_time']:
        op.alter_column('image_processings', column,
                       type_=sa.DateTime(),
                       existing_type=sa.DateTime(timezone=True))
