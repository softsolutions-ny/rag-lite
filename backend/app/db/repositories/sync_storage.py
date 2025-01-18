from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional, Dict, Any, List
import uuid
import os
from google.cloud import storage
from app.db.models.image import Image, ImageProcessing
from app.core.logging import setup_logger

# Set up logging
logger = setup_logger("sync_storage")

class SyncStorageManager:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.gcs_client = storage.Client()
        self.bucket_name = os.getenv("GCS_BUCKET_NAME")
        self.bucket = self.gcs_client.bucket(self.bucket_name)

    def store_image(self, file_path: str, filename: str, user_id: Optional[str] = None) -> Image:
        """Store image in GCS and create database record"""
        # Generate unique GCS key
        gcs_key = f"users/{user_id if user_id else 'anonymous'}/images/{uuid.uuid4()}/{filename}"
        
        # Upload to GCS
        blob = self.bucket.blob(gcs_key)
        blob.upload_from_filename(file_path)
        
        # Get file size and mime type
        file_size = os.path.getsize(file_path)
        mime_type = blob.content_type
        
        # Create database record with explicit type handling
        image = Image(
            id=uuid.uuid4(),
            filename=filename,
            storage_path=gcs_key,  # Store GCS key as storage path
            user_id=str(user_id) if user_id is not None else None  # Explicit None check
        )
        
        try:
            self.db.add(image)
            self.db.commit()
            self.db.refresh(image)
            return image
        except Exception as e:
            self.db.rollback()
            raise e

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

    def get_image_with_analysis(self, image_id: UUID) -> Optional[Dict[str, Any]]:
        """Get image with its latest analysis"""
        image = self.get_image(image_id)
        if not image:
            return None
            
        processing = self.get_latest_processing(image_id)
        
        image_dict = image.to_dict()
        if processing:
            image_dict["analysis"] = {
                "description": processing.description,
                "model_version": processing.model_version,
                "processing_time": processing.duration_seconds,
                "api_time": processing.api_duration_seconds
            }
            
        # Add GCS URL
        if image.storage_path:
            image_dict["gcs_url"] = f"https://storage.googleapis.com/{self.bucket_name}/{image.storage_path}"
            
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