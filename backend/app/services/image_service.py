from openai import OpenAI
import os
import base64
from typing import Dict, Any
import httpx
from app.core.celery_app import celery_app
from app.services.stats_service import sync_stats
from app.db.repositories.storage import SyncStorageManager
from sqlalchemy.orm import Session
from app.core.config import settings, get_sync_db
from app.utils.helpers import is_valid_image
from app.core.logging import setup_logger
from app.db.models.image import ImageProcessing

# Set up logging
logger = setup_logger("image_service")

@celery_app.task(bind=True)
def process_image(self, image_path: str, filename: str, user_id: str) -> Dict[str, Any]:
    job_id = self.request.id  # Get the Celery task ID
    
    # Initialize database session
    db = next(get_sync_db())  # Use sync session for Celery task
    storage = SyncStorageManager(db)  # Use sync storage manager
    
    try:
        # Start timing
        sync_stats.start_processing(db, job_id, user_id)
        logger.info(f"Starting image processing for job {job_id}")
        
        # Update initial state
        self.update_state(state='PROGRESS', meta={
            'status': 'processing',
            'job_id': job_id,
            'filename': filename
        })
        
        # Initialize OpenAI client inside the task
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        
        # Verify the image exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Validate image
        if not is_valid_image(image_path):
            raise ValueError(f"Invalid or corrupted image file: {filename}")
            
        # Read and encode the image
        with open(image_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        
        # Start timing API call
        sync_stats.start_api_call(db, job_id)
        
        # Create OpenAI client with synchronous HTTP client
        with httpx.Client() as http_client:
            client = OpenAI(
                api_key=api_key,
                http_client=http_client
            )
            # Call OpenAI Vision API - gpt-4o-mini IS THE SUPPORTED MODEL. DO NOT CHANGE 
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Please analyze this image and provide a detailed description."},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=500
            )
        
        # End timing API call
        sync_stats.end_api_call(db, job_id)
        
        # Extract the response content
        description = response.choices[0].message.content if response and response.choices else "No description available"
        
        # Store image and analysis after successful OpenAI processing
        stored_image = storage.store_image(image_path, filename, user_id)
        logger.info(f"Stored image with ID: {stored_image.id}")
        
        # Get processing stats and update with analysis results
        processing_stats = sync_stats.end_processing(db, job_id, status="completed", image_id=stored_image.id)
        
        # Update the processing record with analysis results
        processing = db.query(ImageProcessing).filter_by(job_id=job_id).first()
        if processing:
            processing.description = description
            processing.model_version = "gpt-4o-mini"  # Current model version
            db.commit()
        
        # Get complete image data
        result = storage.get_image_with_analysis(stored_image.id)
        result.update({
            "status": "completed",
            "job_id": job_id,
            "stats": processing_stats,
            "error": None
        })
        
        # Clean up the image file after successful storage
        try:
            os.remove(image_path)
        except Exception as e:
            logger.warning(f"Could not remove image file {image_path}: {e}")
        
        logger.info(f"Returning result with processing time: {result['analysis']['processing_time']}")
        
        # Update final state
        self.update_state(state='SUCCESS', meta=result)
        return result
            
    except Exception as e:
        error_msg = f"Error processing image: {str(e)}"
        logger.error(f"Error in job {job_id}: {error_msg}", exc_info=True)
        
        # Record error in stats
        sync_stats.end_processing(db, job_id, status="error")
        
        # Clean up the image on error
        try:
            os.remove(image_path)
        except Exception:
            pass
            
        error_result = {
            "status": "error",
            "job_id": job_id,
            "filename": filename,
            "error": error_msg,
            "exc_type": type(e).__name__,
            "exc_message": str(e),
            "exc_module": e.__class__.__module__
        }
        
        # Update error state with proper exception info
        self.update_state(state='FAILURE', meta=error_result)
        return error_result
    finally:
        # Always close the database session
        db.close() 