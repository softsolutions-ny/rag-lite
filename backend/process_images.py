from openai import OpenAI
import os
from celery_app import celery_app
import base64
from typing import Dict, Any
import httpx
from stats import stats  # Import the stats module
from db.storage import StorageManager
from sqlalchemy.orm import Session
from settings import settings, SessionLocal
from utils import is_valid_image
from logger import setup_logger

# Set up logging
logger = setup_logger("process_images")

@celery_app.task(bind=True)
def process_image(self, image_path: str, filename: str, user_id: str) -> Dict[str, Any]:
    job_id = self.request.id  # Get the Celery task ID
    
    # Initialize database session
    db = SessionLocal()
    storage = StorageManager(db)
    
    try:
        # Start timing
        stats.start_processing(db, job_id, user_id)
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
        stats.start_api_call(db, job_id)
        
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
        stats.end_api_call(db, job_id)
        
        # Extract the response content
        description = response.choices[0].message.content if response and response.choices else "No description available"
        
        # Store image and analysis after successful OpenAI processing
        stored_image = storage.store_image(image_path, filename, user_id)
        logger.info(f"Stored image with ID: {stored_image.id}")
        
        # Store analysis
        analysis = storage.store_analysis(
            image_id=stored_image.id,
            description=description,
            processing_time=0.0  # We'll update this with the actual time
        )
        
        # Get processing stats and update the job with the image ID
        processing_stats = stats.end_processing(db, job_id, status="completed", image_id=stored_image.id)
        logger.info(f"Got processing stats for job {job_id}: {processing_stats}")
        
        # Update the analysis processing time with the API duration
        if processing_stats.get("api_duration_seconds"):
            analysis.processing_time = processing_stats["api_duration_seconds"]
            db.commit()
        
        # Get complete image data with analysis
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
        stats.end_processing(db, job_id, status="error")
        
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
