"""standardize_timestamps

Revision ID: standardize_timestamps
Revises: c1a10ec3d10f
Create Date: 2025-01-24 16:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'standardize_timestamps'
down_revision: Union[str, None] = 'c1a10ec3d10f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Fix ChatMessage created_at to use timezone
    op.alter_column('chat_messages', 'created_at',
                    type_=sa.DateTime(timezone=True),
                    existing_type=sa.DateTime(),
                    postgresql_using='created_at AT TIME ZONE \'UTC\'',
                    server_default=sa.text('NOW()'))
    
    # 2. Add indexes on frequently queried timestamp columns
    op.create_index('idx_chat_messages_created_at', 'chat_messages', ['created_at'])
    op.create_index('idx_chat_threads_updated_at', 'chat_threads', ['updated_at'])
    op.create_index('idx_images_uploaded_at', 'images', ['uploaded_at'])
    op.create_index('idx_image_processings_start_time', 'image_processings', ['start_time'])
    
    # 3. Add NOT NULL constraints where appropriate
    op.alter_column('chat_messages', 'created_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=False)
    op.alter_column('chat_threads', 'created_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=False)
    op.alter_column('chat_threads', 'updated_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=False)
    op.alter_column('chat_folders', 'created_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=False)
    op.alter_column('chat_folders', 'updated_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=False)
    op.alter_column('images', 'uploaded_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=False)

def downgrade() -> None:
    # 1. Remove indexes
    op.drop_index('idx_chat_messages_created_at')
    op.drop_index('idx_chat_threads_updated_at')
    op.drop_index('idx_images_uploaded_at')
    op.drop_index('idx_image_processings_start_time')
    
    # 2. Remove NOT NULL constraints
    op.alter_column('chat_messages', 'created_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=True)
    op.alter_column('chat_threads', 'created_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=True)
    op.alter_column('chat_threads', 'updated_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=True)
    op.alter_column('chat_folders', 'created_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=True)
    op.alter_column('chat_folders', 'updated_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=True)
    op.alter_column('images', 'uploaded_at',
                    existing_type=sa.DateTime(timezone=True),
                    nullable=True)
    
    # 3. Revert ChatMessage created_at to non-timezone
    op.alter_column('chat_messages', 'created_at',
                    type_=sa.DateTime(),
                    existing_type=sa.DateTime(timezone=True)) 