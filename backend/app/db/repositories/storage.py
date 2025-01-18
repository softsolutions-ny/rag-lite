from typing import List, Dict, Any, Optional
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from app.db.models.image import Image, ImageProcessing
from app.core.logging import setup_logger

# Set up logging
logger = setup_logger("storage")

class StorageManager:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def store_image(self, file_path: str, filename: str, user_id: str) -> Image:
        """Store image metadata in database"""
        image = Image(
            filename=filename,
            user_id=user_id,
            storage_path=file_path
        )
        self.db.add(image)
        await self.db.commit()
        await self.db.refresh(image)
        return image

    async def get_image(self, image_id: uuid.UUID) -> Optional[Image]:
        """Get image by ID"""
        stmt = select(Image).filter_by(id=image_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_image_with_analysis(self, image_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Get image with its latest analysis"""
        image = await self.get_image(image_id)
        if not image:
            return None

        # Get the latest processing
        stmt = select(ImageProcessing).filter_by(image_id=image_id).order_by(ImageProcessing.start_time.desc())
        result = await self.db.execute(stmt)
        processing = result.scalar_one_or_none()

        image_dict = image.to_dict()
        if processing:
            image_dict["analysis"] = {
                "description": processing.description,
                "model_version": processing.model_version,
                "processing_time": processing.duration_seconds,
                "api_time": processing.api_duration_seconds
            }
        return image_dict

    async def get_user_images(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all images for a user with their latest analysis"""
        stmt = select(Image).filter_by(user_id=user_id).order_by(Image.uploaded_at.desc())
        result = await self.db.execute(stmt)
        images = result.scalars().all()

        image_list = []
        for image in images:
            image_dict = await self.get_image_with_analysis(image.id)
            if image_dict:
                image_list.append(image_dict)
        return image_list

    async def delete_image(self, image_id: uuid.UUID) -> bool:
        """Delete an image and its analysis"""
        image = await self.get_image(image_id)
        if image:
            await self.db.delete(image)
            await self.db.commit()
            return True
        return False

class SyncStorageManager:
    def __init__(self, db: Session):
        self.db = db

    def store_image(self, file_path: str, filename: str, user_id: str) -> Image:
        """Store image metadata in database"""
        image = Image(
            filename=filename,
            user_id=user_id,
            storage_path=file_path
        )
        self.db.add(image)
        self.db.commit()
        self.db.refresh(image)
        return image

    def get_image(self, image_id: uuid.UUID) -> Optional[Image]:
        """Get image by ID"""
        return self.db.query(Image).filter_by(id=image_id).first()

    def get_image_with_analysis(self, image_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Get image with its latest analysis"""
        image = self.get_image(image_id)
        if not image:
            return None

        # Get the latest processing
        processing = (self.db.query(ImageProcessing)
                    .filter_by(image_id=image_id)
                    .order_by(ImageProcessing.start_time.desc())
                    .first())

        image_dict = image.to_dict()
        if processing:
            image_dict["analysis"] = {
                "description": processing.description,
                "model_version": processing.model_version,
                "processing_time": processing.duration_seconds,
                "api_time": processing.api_duration_seconds
            }
        return image_dict

    def get_user_images(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all images for a user with their latest analysis"""
        images = (self.db.query(Image)
                .filter_by(user_id=user_id)
                .order_by(Image.uploaded_at.desc())
                .all())

        image_list = []
        for image in images:
            image_dict = self.get_image_with_analysis(image.id)
            if image_dict:
                image_list.append(image_dict)
        return image_list

    def delete_image(self, image_id: uuid.UUID) -> bool:
        """Delete an image and its analysis"""
        image = self.get_image(image_id)
        if image:
            self.db.delete(image)
            self.db.commit()
            return True
        return False 