from firecrawl import FirecrawlApp
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.logging import setup_logger
from sqlalchemy.orm import Session
from app.core.config import get_sync_db

# Set up logging
logger = setup_logger("extraction_service")

class ExtractResult(BaseModel):
    """Model for extraction results"""
    url: str
    data: Dict[str, Any]
    status: str
    error: Optional[str] = None

@celery_app.task(bind=True)
def extract_data(
    self,
    urls: List[str],
    prompt: Optional[str] = None,
    schema: Optional[Dict[str, Any]] = None,
    enable_web_search: bool = False,
    user_id: str = None
) -> Dict[str, Any]:
    """
    Extract data from URLs using Firecrawl
    """
    job_id = self.request.id
    
    # Initialize database session
    db = next(get_sync_db())
    
    try:
        logger.info(f"Starting extraction for job {job_id}")
        
        # Update initial state
        self.update_state(state='PROGRESS', meta={
            'status': 'processing',
            'job_id': job_id,
            'urls': urls
        })
        
        # Initialize Firecrawl client
        api_key = settings.FIRECRAWL_API_KEY
        if not api_key:
            raise ValueError("FIRECRAWL_API_KEY environment variable is not set")
        
        app = FirecrawlApp(api_key=api_key)
        
        # Prepare extraction parameters
        extract_params = {
            'enableWebSearch': enable_web_search
        }
        
        if prompt:
            extract_params['prompt'] = prompt
        if schema:
            extract_params['schema'] = schema
            
        # Perform extraction
        result = app.extract(urls, extract_params)
        
        logger.info(f"Extraction completed for job {job_id}")
        
        return {
            'status': 'completed',
            'job_id': job_id,
            'data': result.get('data', {}),
            'urls': urls
        }
        
    except Exception as e:
        logger.error(f"Error in extraction job {job_id}: {str(e)}")
        raise
    finally:
        db.close()

def create_extraction_schema(schema_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Helper function to create a Pydantic schema for extraction"""
    return {
        'type': 'object',
        'properties': schema_dict,
        'required': list(schema_dict.keys())
    } 