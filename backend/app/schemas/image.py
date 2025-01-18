from pydantic import BaseModel, UUID4
from datetime import datetime
from typing import Optional, List, Dict, Any

class ImageBase(BaseModel):
    filename: str
    user_id: str

class ImageCreate(ImageBase):
    storage_path: str

class ImageAnalysis(BaseModel):
    description: Optional[str] = None
    model_version: Optional[str] = None
    processing_time: Optional[float] = None
    api_time: Optional[float] = None

class Image(ImageBase):
    id: UUID4
    uploaded_at: datetime
    storage_path: str
    analysis: Optional[ImageAnalysis] = None

    class Config:
        from_attributes = True

class ProcessingBase(BaseModel):
    job_id: str
    user_id: str
    status: str

class ProcessingCreate(ProcessingBase):
    image_id: Optional[UUID4] = None

class ProcessingUpdate(BaseModel):
    status: str
    description: Optional[str] = None
    model_version: Optional[str] = None
    duration_seconds: Optional[float] = None
    api_duration_seconds: Optional[float] = None

class Processing(ProcessingBase):
    id: UUID4
    image_id: Optional[UUID4] = None
    model_version: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    api_start_time: Optional[datetime] = None
    api_end_time: Optional[datetime] = None
    api_duration_seconds: Optional[float] = None

    class Config:
        from_attributes = True

class JobResponse(BaseModel):
    job_id: str
    filename: str

class JobStatus(BaseModel):
    status: str
    job_id: str
    error: Optional[str] = None
    processing_details: Optional[Dict[str, Any]] = None 