from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Configure engine with PgBouncer settings
engine_args = {
    "echo": True,
    "pool_pre_ping": True,
    "connect_args": {
        "options": "-c search_path=elucide,public"
    }
}

# Add SSL requirement for production
if settings.ENV == "production":
    engine_args["connect_args"]["sslmode"] = "require"
    # Disable prepared statements only for asyncpg
    if "asyncpg" in settings.DATABASE_URL_ASYNC:
        engine_args["connect_args"].update({
            "prepared_statement_cache_size": 0
        })

logger.info(f"Creating async engine with args: {engine_args}")

# Create async engine
async_engine = create_async_engine(
    settings.DATABASE_URL_ASYNC,
    **engine_args
)

# Create async session factory
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