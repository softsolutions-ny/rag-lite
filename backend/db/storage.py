from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional, Dict, Any, List
import uuid
import os
from google.cloud import storage
from .models import Image, ImageProcessing

class StorageManager:
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.gcs_client = storage.Client()
        self.bucket_name = os.getenv("GCS_BUCKET_NAME")
        self.bucket = self.gcs_client.bucket(self.bucket_name)

    async def store_image(self, file_path: str, filename: str, user_id: Optional[str] = None) -> Image:
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
            await self.db.commit()
            return image
        except Exception as e:
            await self.db.rollback()
            raise e

    async def get_latest_processing(self, image_id: UUID) -> Optional[ImageProcessing]:
        """Get the latest processing record for an image"""
        stmt = (
            select(ImageProcessing)
            .filter(ImageProcessing.image_id == image_id)
            .order_by(ImageProcessing.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_image_with_analysis(self, image_id: UUID) -> Dict[str, Any]:
        """Get image and its latest analysis"""
        stmt = select(Image).filter(Image.id == image_id)
        result = await self.db.execute(stmt)
        image = result.scalar_one_or_none()
        if not image:
            return None
            
        processing = await self.get_latest_processing(image_id)
        
        return {
            "id": str(image.id),
            "filename": image.filename,
            "gcs_url": f"https://storage.googleapis.com/{image.gcs_bucket}/{image.gcs_key}",
            "uploaded_at": image.uploaded_at.isoformat(),
            "analysis": {
                "description": processing.description,
                "processing_time": processing.api_duration_seconds,
                "created_at": processing.created_at.isoformat(),
                "model_version": processing.model_version,
                "status": processing.status
            } if processing and processing.status == "completed" else None
        }

    async def get_user_images(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all images and their analyses for a user"""
        stmt = select(Image).filter(Image.user_id == user_id)
        result = await self.db.execute(stmt)
        images = result.scalars().all()
        
        results = []
        for image in images:
            processing = await self.get_latest_processing(image.id)
            results.append({
                "id": str(image.id),
                "filename": image.filename,
                "gcs_url": f"https://storage.googleapis.com/{image.gcs_bucket}/{image.gcs_key}",
                "uploaded_at": image.uploaded_at.isoformat(),
                "analysis": {
                    "description": processing.description,
                    "processing_time": processing.api_duration_seconds,
                    "created_at": processing.created_at.isoformat(),
                    "model_version": processing.model_version,
                    "status": processing.status
                } if processing and processing.status == "completed" else None
            })
            
        return results

    async def delete_image(self, image_id: UUID) -> bool:
        """Delete image and its processing records"""
        stmt = select(Image).filter(Image.id == image_id)
        result = await self.db.execute(stmt)
        image = result.scalar_one_or_none()
        if not image:
            return False
            
        # Delete from GCS
        blob = self.bucket.blob(image.gcs_key)
        if blob.exists():
            blob.delete()
            
        # Database cascade will handle processing records deletion
        await self.db.delete(image)
        await self.db.commit()
        return True