from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
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
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(UUID(as_uuid=True), nullable=True)  # Make nullable for now until auth is implemented

class ImageAnalysis(Base):
    __tablename__ = "image_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id = Column(UUID(as_uuid=True), ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)
    processing_time = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    model_version = Column(String)