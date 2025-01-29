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
    # Environment
    ENV: str = os.getenv("ENV", "development")  # 'development' or 'production'
    
    # Database settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")
    SUPABASE_DATABASE_URL: str = os.getenv("SUPABASE_DATABASE_URL", "")
    
    # Redis settings
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # OpenAI settings
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Groq settings
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    
    # Firecrawl settings
    FIRECRAWL_API_KEY: str = os.getenv("FIRECRAWL_API_KEY", "")
    
    # CORS settings
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    
    # JWT settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # File upload settings
    UPLOAD_DIR: Path = Path(__file__).parent.parent.parent / "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    # Google Cloud Storage settings
    GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "")
    GOOGLE_APPLICATION_CREDENTIALS: Path = Path(__file__).parent.parent.parent / os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "credentials/service-account-key.json")
    
    # Database URLs
    @property
    def DATABASE_URL_BASE(self) -> str:
        """Base PostgreSQL URL without driver"""
        if self.ENV == "production":
            # Use Supabase in production
            return self.SUPABASE_DATABASE_URL.replace("postgresql://", "")
        else:
            # Use local database in development
            return self.DATABASE_URL.replace("postgresql://", "")
    
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
AsyncSessionLocal = sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

SyncSessionLocal = sessionmaker(
    sync_engine,
    class_=Session,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

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
    db = SyncSessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close() 