"""initial schema setup

Revision ID: 9d04d721dbfb
Revises: 
Create Date: 2025-01-29 11:45:29.103178

"""
from typing import Sequence, Union
import logging
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# revision identifiers, used by Alembic.
revision: str = '9d04d721dbfb'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Run migrations"""
    try:
        connection = op.get_bind()
        
        # Create schema and set search path
        connection.execute(text('COMMIT'))
        connection.execute(text('CREATE SCHEMA IF NOT EXISTS elucide'))
        connection.execute(text('SET search_path TO elucide, public'))
        
        # Create tables
        connection.execute(text('''
            CREATE TABLE elucide.chat_folders (
                id UUID PRIMARY KEY,
                user_id VARCHAR NOT NULL,
                name VARCHAR NOT NULL,
                parent_id UUID REFERENCES elucide.chat_folders(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        '''))
        
        connection.execute(text('''
            CREATE TABLE elucide.images (
                id UUID PRIMARY KEY,
                filename VARCHAR NOT NULL,
                user_id VARCHAR NOT NULL,
                uploaded_at TIMESTAMP WITH TIME ZONE,
                storage_path VARCHAR
            )
        '''))
        
        connection.execute(text('''
            CREATE TABLE elucide.chat_threads (
                id UUID PRIMARY KEY,
                user_id VARCHAR NOT NULL,
                title VARCHAR,
                label VARCHAR,
                folder_id UUID REFERENCES elucide.chat_folders(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        '''))
        
        connection.execute(text('''
            CREATE TABLE elucide.image_processings (
                id UUID PRIMARY KEY,
                job_id VARCHAR NOT NULL UNIQUE,
                user_id VARCHAR NOT NULL,
                image_id UUID REFERENCES elucide.images(id),
                status VARCHAR NOT NULL,
                model_version VARCHAR,
                description TEXT,
                start_time TIMESTAMP WITH TIME ZONE,
                end_time TIMESTAMP WITH TIME ZONE,
                duration_seconds FLOAT,
                api_start_time TIMESTAMP WITH TIME ZONE,
                api_end_time TIMESTAMP WITH TIME ZONE,
                api_duration_seconds FLOAT
            )
        '''))
        
        connection.execute(text('''
            CREATE TABLE elucide.chat_messages (
                id UUID PRIMARY KEY,
                thread_id UUID NOT NULL REFERENCES elucide.chat_threads(id),
                role VARCHAR NOT NULL,
                content TEXT NOT NULL,
                model VARCHAR,
                image_url VARCHAR,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            )
        '''))
        
        logger.info("Migration completed successfully!")
    except Exception as e:
        logger.error(f"Error during migration: {str(e)}")
        raise


def downgrade() -> None:
    """Revert migrations"""
    try:
        connection = op.get_bind()
        connection.execute(text('SET search_path TO elucide, public'))
        
        # Drop tables in reverse order
        connection.execute(text('DROP TABLE IF EXISTS elucide.chat_messages'))
        connection.execute(text('DROP TABLE IF EXISTS elucide.image_processings'))
        connection.execute(text('DROP TABLE IF EXISTS elucide.chat_threads'))
        connection.execute(text('DROP TABLE IF EXISTS elucide.images'))
        connection.execute(text('DROP TABLE IF EXISTS elucide.chat_folders'))
        
        # Drop schema
        connection.execute(text('COMMIT'))
        connection.execute(text('DROP SCHEMA IF EXISTS elucide CASCADE'))
        
        logger.info("Downgrade completed successfully!")
    except Exception as e:
        logger.error(f"Error during downgrade: {str(e)}")
        raise
