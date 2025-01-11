from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import os
from dotenv import load_dotenv

load_dotenv()

# Base PostgreSQL URL without driver
BASE_URL = f"{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"

# Async database URL (using asyncpg)
ASYNC_DATABASE_URL = f"postgresql+asyncpg://{BASE_URL}"

# Sync database URL (using psycopg2)
SYNC_DATABASE_URL = f"postgresql://{BASE_URL}"

# Create both async and sync engines
async_engine = create_async_engine(ASYNC_DATABASE_URL, echo=True)
sync_engine = create_engine(SYNC_DATABASE_URL, echo=True)

# Create both async and sync session factories
AsyncSessionLocal = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
SessionLocal = sessionmaker(sync_engine, class_=Session, expire_on_commit=False)

async def get_db():
    """Get async database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

def get_sync_db():
    """Get synchronous database session"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()