from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional, Dict, Any, List
import uuid
import os
from google.cloud import storage
from app.db.models.image import Image, ImageProcessing
from app.core.logging import setup_logger
from app.core.config import settings

# Set up logging
logger = setup_logger("sync_storage")

class SyncStorageManager:
    def __init__(self, db_session: Session):
        self.db = db_session
        try:
            # Ensure credentials file exists
            if not settings.GOOGLE_APPLICATION_CREDENTIALS.exists():
                raise FileNotFoundError(f"GCS credentials file not found at {settings.GOOGLE_APPLICATION_CREDENTIALS}")
            
            # Set credentials environment variable
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(settings.GOOGLE_APPLICATION_CREDENTIALS)
            
            # Initialize GCS client
            self.gcs_client = storage.Client()
            
            # Ensure bucket name is set
            if not settings.GCS_BUCKET_NAME:
                raise ValueError("GCS_BUCKET_NAME environment variable is not set")
            
            # Get bucket
            self.bucket = self.gcs_client.bucket(settings.GCS_BUCKET_NAME)
            
            logger.info(f"Successfully initialized GCS client with bucket {settings.GCS_BUCKET_NAME}")
            
        except Exception as e:
            logger.error(f"Failed to initialize GCS client: {str(e)}", exc_info=True)
            raise

    def get_latest_processing(self, image_id: UUID) -> Optional[ImageProcessing]:
        """Get the latest processing record for an image"""
        return (
            self.db.query(ImageProcessing)
            .filter(ImageProcessing.image_id == image_id)
            .order_by(ImageProcessing.start_time.desc())
            .first()
        )

    def get_image(self, image_id: UUID) -> Optional[Image]:
        """Get image by ID"""
        return self.db.query(Image).filter_by(id=image_id).first()

    def get_public_url(self, storage_path: str) -> str:
        """Get the public URL for a GCS object"""
        try:
            blob = self.bucket.blob(storage_path)
            blob.make_public()  # Ensure the blob is public
            return f"https://storage.googleapis.com/elucide/{storage_path}"
        except Exception as e:
            logger.error(f"Failed to get public URL for {storage_path}: {str(e)}")
            return None

    def get_image_with_analysis(self, image_id: UUID) -> Optional[Dict[str, Any]]:
        """Get image with its latest analysis"""
        image = self.get_image(image_id)
        if not image:
            return None
            
        processing = self.get_latest_processing(image_id)
        
        image_dict = image.to_dict()
        if processing:
            image_dict["processing_details"] = {
                "description": processing.description,
                "model_version": processing.model_version,
                "processing_time": processing.duration_seconds,
                "api_time": processing.api_duration_seconds
            }
            
        # Get public URL for the image
        if image.storage_path:
            try:
                image_dict["public_url"] = self.get_public_url(image.storage_path)
                logger.info(f"Got public URL for image {image_id}")
            except Exception as e:
                logger.error(f"Failed to get public URL for image {image_id}: {str(e)}")
            
        return image_dict

    def get_user_images(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all images and their analyses for a user"""
        images = (self.db.query(Image)
                .filter_by(user_id=user_id)
                .order_by(Image.uploaded_at.desc())
                .all())
        
        results = []
        for image in images:
            image_dict = self.get_image_with_analysis(image.id)
            if image_dict:
                results.append(image_dict)
            
        return results

    def delete_image(self, image_id: UUID) -> bool:
        """Delete image and its processing records"""
        image = self.get_image(image_id)
        if not image:
            return False
            
        # Delete from GCS if storage path exists
        if image.storage_path:
            blob = self.bucket.blob(image.storage_path)
            if blob.exists():
                blob.delete()
            
        # Database cascade will handle processing records deletion
        self.db.delete(image)
        self.db.commit()
        return True 