from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

class Image(Base):
    __tablename__ = "images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False)
    gcs_key = Column(String, nullable=False, index=True)
    gcs_bucket = Column(String, nullable=False)
    mime_type = Column(String)
    file_size = Column(Float)
    uploaded_at = Column(TIMESTAMP(timezone=True), default=datetime.now, index=True)
    user_id = Column(String(255), nullable=True, server_default=text('NULL'), index=True)

    # Single relationship to combined processing table
    processings = relationship("ImageProcessing", back_populates="image", cascade="all, delete-orphan")

class ImageProcessing(Base):
    __tablename__ = "image_processings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(String, unique=True, nullable=False, index=True)  # Celery task ID
    image_id = Column(UUID(as_uuid=True), ForeignKey("images.id", ondelete="CASCADE"), nullable=True, index=True)  # Allow null initially
    user_id = Column(String(255), nullable=True, index=True)
    
    # Job status and timing
    status = Column(String, nullable=False, index=True)
    start_time = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    end_time = Column(TIMESTAMP(timezone=True), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    
    # API timing
    api_start_time = Column(TIMESTAMP(timezone=True), nullable=True)
    api_end_time = Column(TIMESTAMP(timezone=True), nullable=True)
    api_duration_seconds = Column(Float, nullable=True)
    
    # Analysis results
    description = Column(Text, nullable=True)  # Nullable because job might fail
    model_version = Column(String, index=True)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.now, index=True)

    # Relationship
    image = relationship("Image", back_populates="processings")

    def to_dict(self) -> dict:
        """Convert processing record to dictionary"""
        return {
            "id": str(self.id),
            "job_id": self.job_id,
            "status": self.status,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
            "api_start_time": self.api_start_time.isoformat() if self.api_start_time else None,
            "api_end_time": self.api_end_time.isoformat() if self.api_end_time else None,
            "api_duration_seconds": self.api_duration_seconds,
            "description": self.description,
            "model_version": self.model_version,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "image_id": str(self.image_id) if self.image_id else None,
            "user_id": self.user_id
        }