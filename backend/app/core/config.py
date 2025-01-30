from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import asynccontextmanager
from urllib.parse import urlparse, parse_qs
import logging
import sys
from sqlalchemy.pool import NullPool

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger("config")

# Debug: Print all environment variables at startup
logger.info("=== Environment Variables at Startup ===")
for key in sorted(os.environ.keys()):
    if "URL" in key or "ENV" in key:  # Only log relevant variables
        value = os.environ[key]
        # Mask sensitive information in URLs
        if "URL" in key and "://" in value:
            parsed = urlparse(value)
            masked = f"{parsed.scheme}://{parsed.hostname}:{parsed.port}{parsed.path}"
            logger.info(f"{key}: {masked}")
        else:
            logger.info(f"{key}: {value}")

# Determine environment
ENV = os.getenv("ENV", "development")
logger.info(f"Initial ENV value: {ENV}")

if ENV not in ["development", "production"]:
    logger.error(f"Invalid environment: {ENV}")
    raise ValueError(f"Invalid environment: {ENV}. Must be 'development' or 'production'")

# Only load .env file in development
if ENV == "development":
    env_file = ".env"
    env_path = Path(__file__).parent.parent.parent / env_file
    
    logger.info(f"Looking for environment file: {env_path} (absolute: {env_path.absolute()})")
    
    if env_path.exists():
        logger.info(f"Loading environment variables from: {env_path}")
        load_dotenv(dotenv_path=env_path, override=True)
    else:
        logger.warning(f"Development environment file not found: {env_path}")
else:
    logger.info("Production environment detected, using system environment variables")

# Verify environment after loading .env
logger.info(f"ENV after environment setup: {os.getenv('ENV')}")
logger.info(f"DATABASE_URL available: {bool(os.getenv('DATABASE_URL'))}")
logger.info(f"SUPABASE_DATABASE_URL available: {bool(os.getenv('SUPABASE_DATABASE_URL'))}")

class Settings(BaseSettings):
    # Environment
    ENV: str = ENV
    
    # Database settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
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
    
    def _process_db_url(self, url: str) -> str:
        """Process database URL to handle search_path correctly"""
        if not url:
            logger.error(f"Empty database URL provided")
            return ""
            
        parsed = urlparse(url)
        logger.info(f"Processing database URL: {parsed.scheme}://{parsed.hostname}:{parsed.port}{parsed.path}")
        
        # Add search_path to query parameters
        query_params = parse_qs(parsed.query)
        if 'options' in query_params:
            logger.info("Removing 'options' from query parameters")
            del query_params['options']
            
        # Reconstruct the URL without options
        base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if query_params:
            query_string = "&".join(f"{k}={v[0]}" for k, v in query_params.items())
            base_url = f"{base_url}?{query_string}"
            
        logger.info(f"Processed database URL: {urlparse(base_url).scheme}://{urlparse(base_url).hostname}:{urlparse(base_url).port}{urlparse(base_url).path}")
        return base_url
    
    @property
    def DATABASE_URL_BASE(self) -> str:
        """Get the base database URL"""
        logger.info(f"Getting database URL for environment: {self.ENV}")
        logger.info(f"Available URLs - Development: {bool(self.DATABASE_URL)}, Production: {bool(self.SUPABASE_DATABASE_URL)}")
        
        if self.ENV == "development":
            if not self.DATABASE_URL:
                logger.error("DATABASE_URL is not configured in .env file")
                raise ValueError("DATABASE_URL is not configured in .env file")
            logger.info("Using development database")
            return self._process_db_url(self.DATABASE_URL)
        else:
            if not self.SUPABASE_DATABASE_URL:
                logger.error("SUPABASE_DATABASE_URL is not configured in .env.production file")
                raise ValueError("SUPABASE_DATABASE_URL is not configured in .env.production file")
            logger.info("Using production database")
            return self._process_db_url(self.SUPABASE_DATABASE_URL)
    
    @property
    def DATABASE_URL_ASYNC(self) -> str:
        """Get async database URL."""
        if self.ENV == "production":
            # Ensure credentials are properly included
            url = self.SUPABASE_DATABASE_URL
            if not url.startswith("postgresql://postgres.jplojzerdrxmmknoehpi:"):
                logger.warning("Database URL missing credentials, attempting to reconstruct")
                url = f"postgresql://postgres.jplojzerdrxmmknoehpi:JKgxGcf1JPoFQaeCYA1f9T0nTpL6Ix@{urlparse(url).netloc}/postgres"
            return url.replace("postgresql://", "postgresql+asyncpg://")
        return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Get sync database URL."""
        if self.ENV == "production":
            url = self.SUPABASE_DATABASE_URL
            if not url.startswith("postgresql://postgres.jplojzerdrxmmknoehpi:"):
                logger.warning("Database URL missing credentials, attempting to reconstruct")
                url = f"postgresql://postgres.jplojzerdrxmmknoehpi:JKgxGcf1JPoFQaeCYA1f9T0nTpL6Ix@{urlparse(url).netloc}/postgres"
            return url
        return self.DATABASE_URL
    
    class Config:
        case_sensitive = True

logger.info("Creating Settings instance")
settings = Settings()

logger.info("=== Final Configuration ===")
logger.info(f"Environment: {settings.ENV}")
logger.info(f"Development Database Available: {bool(settings.DATABASE_URL)}")
logger.info(f"Production Database Available: {bool(settings.SUPABASE_DATABASE_URL)}")

# Log which database URL we're using (without sensitive info)
db_url = settings.DATABASE_URL_BASE
if db_url:
    parsed = urlparse(db_url)
    safe_url = f"{parsed.scheme}://{parsed.hostname}:{parsed.port}{parsed.path}"
    logger.info(f"Using database: {safe_url}")

# Ensure upload directory exists
settings.UPLOAD_DIR.mkdir(exist_ok=True)

# Create database engines with schema configuration
base_engine_args = {
    "echo": True,
    "poolclass": NullPool,  # Disable SQLAlchemy pooling
    "connect_args": {
        "server_settings": {
            "search_path": "elucide,public"
        }
    },
    "execution_options": {
        "isolation_level": "READ COMMITTED"
    }
}

# Add production-specific settings
if ENV == "production":
    base_engine_args["pool_pre_ping"] = False
    base_engine_args["connect_args"].update({
        "ssl": "require",
        "prepared_statement_cache_size": 0,
        "options": "-c statement_cache_size=0"
    })
else:
    base_engine_args["pool_pre_ping"] = True

logger.info("Creating database engines with schema: elucide,public")
# Create database engines
async_engine = create_async_engine(
    settings.DATABASE_URL_ASYNC,
    **base_engine_args
)

# Sync engine uses the same configuration
sync_engine_args = {
    **base_engine_args,
    "connect_args": {
        "options": "-c search_path=elucide,public -c statement_cache_size=0",
        "prepared_statement_cache_size": 0
    }
}

if ENV == "production":
    sync_engine_args["connect_args"]["sslmode"] = "require"

sync_engine = create_engine(
    settings.DATABASE_URL_SYNC,
    **sync_engine_args
)

# Add logging for connection details
logger.info(f"Async Database URL (masked): {urlparse(settings.DATABASE_URL_ASYNC).hostname}")
logger.info(f"Async Engine Arguments: {base_engine_args}")
logger.info(f"Sync Engine Arguments: {sync_engine_args}")

logger.info("Creating session factories")
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
    logger.debug("Creating new async database session")
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
            logger.debug("Async session committed successfully")
        except Exception as e:
            logger.error(f"Error in async session: {e}")
            await session.rollback()
            raise
        finally:
            logger.debug("Closing async session")
            await session.close()

def get_sync_db():
    """Get synchronous database session"""
    logger.debug("Creating new sync database session")
    db = SyncSessionLocal()
    try:
        yield db
        db.commit()
        logger.debug("Sync session committed successfully")
    except Exception as e:
        logger.error(f"Error in sync session: {e}")
        db.rollback()
        raise
    finally:
        logger.debug("Closing sync session")
        db.close() 