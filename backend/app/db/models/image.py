from sqlalchemy import Column, String, DateTime, Integer, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from typing import Dict, Any
from app.db.base import Base

def utcnow_with_timezone():
    return datetime.now(timezone.utc)

class Image(Base):
    __tablename__ = "images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=utcnow_with_timezone)
    storage_path = Column(String)
    
    # Relationships
    processings = relationship("ImageProcessing", back_populates="image", cascade="all, delete-orphan")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert image to dictionary"""
        return {
            "id": str(self.id),
            "filename": self.filename,
            "user_id": self.user_id,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "storage_path": self.storage_path
        }

class ImageProcessing(Base):
    __tablename__ = "image_processings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(String, unique=True, nullable=False)
    user_id = Column(String, nullable=False)
    image_id = Column(UUID(as_uuid=True), ForeignKey("images.id"))
    
    # Processing metadata
    status = Column(String, nullable=False)  # pending, processing, completed, error
    model_version = Column(String)  # OpenAI model version used
    description = Column(Text)  # Generated description
    
    # Timing information
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    duration_seconds = Column(Float)
    
    # API call timing
    api_start_time = Column(DateTime(timezone=True))
    api_end_time = Column(DateTime(timezone=True))
    api_duration_seconds = Column(Float)
    
    # Relationships
    image = relationship("Image", back_populates="processings")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert processing record to dictionary"""
        return {
            "id": str(self.id),
            "job_id": self.job_id,
            "user_id": self.user_id,
            "image_id": str(self.image_id) if self.image_id else None,
            "status": self.status,
            "model_version": self.model_version,
            "description": self.description,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
            "api_start_time": self.api_start_time.isoformat() if self.api_start_time else None,
            "api_end_time": self.api_end_time.isoformat() if self.api_end_time else None,
            "api_duration_seconds": self.api_duration_seconds
        } 