from openai import OpenAI
import os
import base64
from typing import Dict, Any
import httpx
from app.core.celery_app import celery_app
from app.services.stats_service import sync_stats
from app.db.repositories.sync_storage import SyncStorageManager
from sqlalchemy.orm import Session
from app.core.config import settings, get_sync_db
from app.utils.helpers import is_valid_image
from app.core.logging import setup_logger
from app.db.models.image import ImageProcessing, Image
import uuid
from google.cloud import storage
from datetime import timedelta

# Set up logging
logger = setup_logger("image_service")

@celery_app.task(bind=True)
def upload_image(self, image_path: str, filename: str, user_id: str) -> Dict[str, Any]:
    job_id = self.request.id  # Get the Celery task ID
    
    # Initialize database session
    db = next(get_sync_db())  # Use sync session for Celery task
    storage_manager = SyncStorageManager(db)  # Use sync storage manager
    
    try:
        # Start timing
        sync_stats.start_processing(db, job_id, user_id)
        logger.info(f"Starting image upload for job {job_id}")
        
        # Update initial state
        self.update_state(state='PROGRESS', meta={
            'status': 'processing',
            'job_id': job_id,
            'filename': filename
        })
        
        # Verify the image exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Validate image
        if not is_valid_image(image_path):
            raise ValueError(f"Invalid or corrupted image file: {filename}")
            
        try:
            # Generate GCS key first
            image_id = uuid.uuid4()
            gcs_key = f"users/{user_id}/images/{image_id}/{filename}"
            
            # Initialize GCS client and upload
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(settings.GOOGLE_APPLICATION_CREDENTIALS)
            gcs_client = storage.Client()
            bucket = gcs_client.bucket(settings.GCS_BUCKET_NAME)
            blob = bucket.blob(gcs_key)
            
            # Set blob metadata and upload
            blob.content_type = "image/jpeg"
            blob.cache_control = "public, max-age=31536000"  # Cache for 1 year
            
            # Upload the file with public read access
            blob.upload_from_filename(image_path, predefined_acl='publicRead')
            
            # Make sure the blob is public
            blob.make_public()
            
            # Get the public URL
            public_url = f"https://storage.googleapis.com/elucide/{gcs_key}"
            logger.info(f"Image available at public URL: {public_url}")
            
            # Create database record with GCS key
            image = Image(
                id=image_id,
                filename=filename,
                storage_path=gcs_key,
                user_id=user_id
            )
            db.add(image)
            db.commit()
            db.refresh(image)
            logger.info(f"Created database record for image {image.id}")
            
            # Get processing stats
            processing_stats = sync_stats.end_processing(db, job_id, status="completed", image_id=image.id)
            
            # Get complete image data and include public URL
            result = storage_manager.get_image_with_analysis(image.id)
            result.update({
                "status": "completed",
                "job_id": job_id,
                "stats": processing_stats,
                "error": None,
                "public_url": public_url  # Include the public URL in the response
            })
            
            logger.info(f"Successfully uploaded and stored image {image.id}")
            
            # Update final state
            self.update_state(state='SUCCESS', meta=result)
            return result
            
        finally:
            # Always clean up the temporary file
            try:
                if os.path.exists(image_path):
                    os.remove(image_path)
                    logger.info(f"Cleaned up temporary file: {image_path}")
            except Exception as e:
                logger.error(f"Failed to clean up temporary file {image_path}: {str(e)}")
                
    except Exception as e:
        error_msg = f"Error uploading image: {str(e)}"
        logger.error(f"Error in job {job_id}: {error_msg}", exc_info=True)
        
        # Record error in stats
        sync_stats.end_processing(db, job_id, status="error")
        
        # Clean up the temporary file on error
        try:
            if os.path.exists(image_path):
                os.remove(image_path)
                logger.info(f"Cleaned up temporary file after error: {image_path}")
        except Exception as cleanup_error:
            logger.error(f"Failed to clean up temporary file {image_path}: {str(cleanup_error)}")
            
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

@celery_app.task(bind=True)
def analyze_image(self, image_id: str, prompt: str) -> Dict[str, Any]:
    job_id = self.request.id  # Get the Celery task ID
    
    # Initialize database session
    db = next(get_sync_db())  # Use sync session for Celery task
    storage_manager = SyncStorageManager(db)  # Use sync storage manager
    
    try:
        # Start timing
        sync_stats.start_processing(db, job_id, None)  # No user_id needed for analysis
        logger.info(f"Starting image analysis for job {job_id}")
        
        # Update initial state
        self.update_state(state='PROGRESS', meta={
            'status': 'processing',
            'job_id': job_id,
            'image_id': image_id
        })
        
        # Get the image from the database
        image = db.query(Image).filter_by(id=image_id).first()
        if not image:
            raise ValueError(f"Image not found with ID: {image_id}")
            
        # Get the image data from GCS
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(settings.GOOGLE_APPLICATION_CREDENTIALS)
        gcs_client = storage.Client()
        bucket = gcs_client.bucket(settings.GCS_BUCKET_NAME)
        blob = bucket.blob(image.storage_path)
        
        # Download the image to a temporary file
        temp_path = f"/tmp/{image.filename}"
        blob.download_to_filename(temp_path)
        
        try:
            # Read and encode the image
            with open(temp_path, "rb") as image_file:
                base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            
            # Start timing API call
            sync_stats.start_api_call(db, job_id)
            
            # Create OpenAI client with synchronous HTTP client
            with httpx.Client() as http_client:
                client = OpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    http_client=http_client,
                    base_url="https://api.openai.com/v1"
                )
                # Call OpenAI Vision API with user's prompt
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{base64_image}",
                                        "detail": "low"
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
                
                # Update the processing record with analysis results
                processing = ImageProcessing(
                    job_id=job_id,
                    image_id=image_id,
                    description=description,
                    model_version="gpt-4o-mini"  # Current model version
                )
                db.add(processing)
                db.commit()
                
                # Get processing stats
                processing_stats = sync_stats.end_processing(db, job_id, status="completed", image_id=image_id)
                
                # Get complete image data
                result = storage_manager.get_image_with_analysis(image_id)
                result.update({
                    "status": "completed",
                    "job_id": job_id,
                    "stats": processing_stats,
                    "error": None,
                    "processing_details": {
                        "description": description,
                        "model_version": "gpt-4o-mini"
                    }
                })
                
                logger.info(f"Successfully analyzed image {image_id}")
                
                # Update final state
                self.update_state(state='SUCCESS', meta=result)
                return result
                
        finally:
            # Always clean up the temporary file
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    logger.info(f"Cleaned up temporary file: {temp_path}")
            except Exception as e:
                logger.error(f"Failed to clean up temporary file {temp_path}: {str(e)}")
                
    except Exception as e:
        error_msg = f"Error analyzing image: {str(e)}"
        logger.error(f"Error in job {job_id}: {error_msg}", exc_info=True)
        
        # Record error in stats
        sync_stats.end_processing(db, job_id, status="error")
            
        error_result = {
            "status": "error",
            "job_id": job_id,
            "image_id": image_id,
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