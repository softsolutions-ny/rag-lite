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

# Determine environment and load appropriate .env file
ENV = os.getenv("ENV", "development")
logger.info(f"Initial ENV value: {ENV}")

if ENV not in ["development", "production"]:
    logger.error(f"Invalid environment: {ENV}")
    raise ValueError(f"Invalid environment: {ENV}. Must be 'development' or 'production'")

env_file = ".env.production" if ENV == "production" else ".env"
env_path = Path(__file__).parent.parent.parent / env_file

logger.info(f"Looking for environment file: {env_path} (absolute: {env_path.absolute()})")

if not env_path.exists():
    logger.error(f"Environment file not found: {env_path}")
    raise FileNotFoundError(f"Environment file not found: {env_path}")

# Load environment variables
logger.info(f"Loading environment variables from: {env_path}")
load_dotenv(dotenv_path=env_path, override=True)

# Verify environment after loading .env
logger.info(f"ENV after loading .env: {os.getenv('ENV')}")
logger.info(f"DATABASE_URL after loading .env: {bool(os.getenv('DATABASE_URL'))}")
logger.info(f"SUPABASE_DATABASE_URL after loading .env: {bool(os.getenv('SUPABASE_DATABASE_URL'))}")

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
        """Async database URL (using asyncpg)"""
        base_url = self.DATABASE_URL_BASE
        if not base_url:
            logger.error("Database URL is not configured")
            raise ValueError("Database URL is not configured")
        async_url = f"postgresql+asyncpg://{base_url.replace('postgresql://', '')}"
        logger.info(f"Async database URL: {urlparse(async_url).scheme}://{urlparse(async_url).hostname}:{urlparse(async_url).port}{urlparse(async_url).path}")
        return async_url

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Sync database URL (using psycopg2)"""
        if not self.DATABASE_URL_BASE:
            logger.error("Database URL is not configured")
            raise ValueError("Database URL is not configured")
        logger.info(f"Sync database URL: {urlparse(self.DATABASE_URL_BASE).scheme}://{urlparse(self.DATABASE_URL_BASE).hostname}:{urlparse(self.DATABASE_URL_BASE).port}{urlparse(self.DATABASE_URL_BASE).path}")
        return self.DATABASE_URL_BASE
    
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
engine_args = {
    "echo": True,
    "connect_args": {"options": "-c search_path=elucide,public"}
}

logger.info("Creating database engines")
# Create database engines
async_engine = create_async_engine(settings.DATABASE_URL_ASYNC, **engine_args)
sync_engine = create_engine(settings.DATABASE_URL_SYNC, **engine_args)

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