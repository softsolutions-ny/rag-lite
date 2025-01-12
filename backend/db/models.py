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
    gcs_key = Column(String, nullable=False)
    gcs_bucket = Column(String, nullable=False)
    mime_type = Column(String)
    file_size = Column(Float)
    uploaded_at = Column(TIMESTAMP(timezone=True), default=datetime.now)
    user_id = Column(String(255), nullable=True, server_default=text('NULL'))

    # Relationships
    analysis = relationship("ImageAnalysis", back_populates="image", uselist=False, cascade="all, delete-orphan")
    job = relationship("JobStats", back_populates="image", uselist=False)

class ImageAnalysis(Base):
    __tablename__ = "image_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id = Column(UUID(as_uuid=True), ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)
    processing_time = Column(Float)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.now)
    model_version = Column(String)

    # Relationships
    image = relationship("Image", back_populates="analysis")

class JobStats(Base):
    __tablename__ = "job_stats"

    job_id = Column(String, primary_key=True)
    status = Column(String, nullable=False)
    user_id = Column(String(255), nullable=True)
    
    # Timing fields
    start_time = Column(TIMESTAMP(timezone=True), nullable=False)
    end_time = Column(TIMESTAMP(timezone=True), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    
    # API timing fields
    api_start_time = Column(TIMESTAMP(timezone=True), nullable=True)
    api_end_time = Column(TIMESTAMP(timezone=True), nullable=True)
    api_duration_seconds = Column(Float, nullable=True)
    
    # Relationship to Image
    image_id = Column(UUID(as_uuid=True), ForeignKey("images.id", ondelete="SET NULL"), nullable=True)
    image = relationship("Image", back_populates="job")

    def to_dict(self) -> dict:
        """Convert job stats to dictionary"""
        return {
            "job_id": self.job_id,
            "status": self.status,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
            "api_start_time": self.api_start_time.isoformat() if self.api_start_time else None,
            "api_end_time": self.api_end_time.isoformat() if self.api_end_time else None,
            "api_duration_seconds": self.api_duration_seconds,
            "image_id": str(self.image_id) if self.image_id else None,
            "user_id": self.user_id
        }