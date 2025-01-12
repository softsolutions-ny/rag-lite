from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import asynccontextmanager

# Load environment variables
load_dotenv()

class Settings(BaseSettings):
    # Database settings
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    
    # Redis settings
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # OpenAI settings
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # CORS settings
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    
    # JWT settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # File upload settings
    UPLOAD_DIR: Path = Path(__file__).parent / "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # Database URLs
    @property
    def DATABASE_URL_BASE(self) -> str:
        """Base PostgreSQL URL without driver"""
        return f"{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def DATABASE_URL_ASYNC(self) -> str:
        """Async database URL (using asyncpg)"""
        return f"postgresql+asyncpg://{self.DATABASE_URL_BASE}"
    
    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Sync database URL (using psycopg2)"""
        return f"postgresql://{self.DATABASE_URL_BASE}"
    
    class Config:
        case_sensitive = True

# Create a global settings instance
settings = Settings()

# Ensure upload directory exists
settings.UPLOAD_DIR.mkdir(exist_ok=True)

# Create database engines
async_engine = create_async_engine(settings.DATABASE_URL_ASYNC, echo=True)
sync_engine = create_engine(settings.DATABASE_URL_SYNC, echo=True)

# Create session factories
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