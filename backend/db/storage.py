from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional, Dict, Any
import uuid
import os
from google.cloud import storage
from .models import Image, ImageAnalysis

class StorageManager:
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
            gcs_key=gcs_key,
            gcs_bucket=self.bucket_name,
            mime_type=mime_type,
            file_size=file_size,
            user_id=str(user_id) if user_id is not None else None  # Explicit None check
        )
        
        try:
            self.db.add(image)
            self.db.commit()
            return image
        except Exception as e:
            self.db.rollback()
            raise e

    def store_analysis(self, image_id: UUID, description: str, processing_time: float, model_version: str = "gpt-4o-mini") -> ImageAnalysis:
        """Store image analysis results"""
        analysis = ImageAnalysis(
            image_id=image_id,
            description=description,
            processing_time=processing_time,
            model_version=model_version
        )
        
        self.db.add(analysis)
        self.db.commit()
        return analysis

    def get_image_with_analysis(self, image_id: UUID) -> Dict[str, Any]:
        """Get image and its analysis"""
        image = self.db.query(Image).filter(Image.id == image_id).first()
        if not image:
            return None
            
        analysis = self.db.query(ImageAnalysis).filter(ImageAnalysis.image_id == image_id).first()
        
        return {
            "id": str(image.id),
            "filename": image.filename,
            "gcs_url": f"https://storage.googleapis.com/{image.gcs_bucket}/{image.gcs_key}",
            "uploaded_at": image.uploaded_at.isoformat(),
            "analysis": {
                "description": analysis.description,
                "processing_time": analysis.processing_time,
                "created_at": analysis.created_at.isoformat()
            } if analysis else None
        }

    def get_user_images(self, user_id: str) -> list[Dict[str, Any]]:
        """Get all images and their analyses for a user"""
        images = self.db.query(Image).filter(Image.user_id == user_id).all()
        
        results = []
        for image in images:
            analysis = self.db.query(ImageAnalysis).filter(ImageAnalysis.image_id == image.id).first()
            results.append({
                "id": str(image.id),
                "filename": image.filename,
                "gcs_url": f"https://storage.googleapis.com/{image.gcs_bucket}/{image.gcs_key}",
                "uploaded_at": image.uploaded_at.isoformat(),
                "analysis": {
                    "description": analysis.description,
                    "processing_time": analysis.processing_time,
                    "created_at": analysis.created_at.isoformat()
                } if analysis else None
            })
            
        return results

    def delete_image(self, image_id: UUID) -> bool:
        """Delete image and its analysis"""
        image = self.db.query(Image).filter(Image.id == image_id).first()
        if not image:
            return False
            
        # Delete from GCS
        blob = self.bucket.blob(image.gcs_key)
        if blob.exists():
            blob.delete()
            
        # Database cascade will handle analysis deletion
        self.db.delete(image)
        self.db.commit()
        return True
