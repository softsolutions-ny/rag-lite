from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Configure engine with PgBouncer transaction mode settings
engine_args = {
    "echo": True,
    "poolclass": NullPool,  # Disable SQLAlchemy pooling since we're using PgBouncer
    "connect_args": {
        "options": "-c search_path=elucide,public",
        "server_settings": {
            "statement_cache_size": "0",  # Required for PgBouncer transaction mode
            "prepared_statements": "false"  # Disable prepared statements
        }
    }
}

# Add SSL requirement for production
if settings.ENV == "production":
    engine_args["connect_args"]["sslmode"] = "require"
    # Additional settings for PgBouncer transaction mode
    engine_args.update({
        "pool_pre_ping": False,  # Disable pool pre-ping with PgBouncer
        "execution_options": {
            "isolation_level": "READ_COMMITTED"
        }
    })

logger.info(f"Creating async engine with args: {engine_args}")

# Create async engine
async_engine = create_async_engine(
    settings.DATABASE_URL_ASYNC,
    **engine_args
)

# Create async session factory with specific settings for PgBouncer
AsyncSessionLocal = sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close() 