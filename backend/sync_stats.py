from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from db.models import ImageProcessing, Image
from logger import setup_logger

# Set up logging
logger = setup_logger("sync_stats")

class SyncProcessingStats:
    def __init__(self):
        """Initialize ProcessingStats"""
        pass
    
    def _get_utc_now(self) -> datetime:
        """Get current UTC timestamp"""
        return datetime.now(timezone.utc)
    
    def start_processing(self, db: Session, job_id: str, user_id: str) -> None:
        """Record the start of processing for a job"""
        processing = ImageProcessing(
            job_id=job_id,
            user_id=user_id,
            start_time=self._get_utc_now(),
            status="processing"
        )
        db.add(processing)
        db.commit()
        logger.info(f"Started processing job {job_id}")
    
    def start_api_call(self, db: Session, job_id: str) -> None:
        """Record the start of the API call"""
        processing = db.query(ImageProcessing).filter_by(job_id=job_id).first()
        if processing:
            processing.api_start_time = self._get_utc_now()
            db.commit()
            logger.info(f"Started API call for job {job_id}")
    
    def end_api_call(self, db: Session, job_id: str) -> None:
        """Record the end of the API call"""
        processing = db.query(ImageProcessing).filter_by(job_id=job_id).first()
        if processing and processing.api_start_time:
            api_end_time = self._get_utc_now()
            # Ensure both timestamps are timezone-aware
            if processing.api_start_time.tzinfo is None:
                processing.api_start_time = processing.api_start_time.replace(tzinfo=timezone.utc)
            
            api_duration = (api_end_time - processing.api_start_time).total_seconds()
            
            processing.api_end_time = api_end_time
            processing.api_duration_seconds = round(api_duration, 2)
            db.commit()
            logger.info(f"Ended API call for job {job_id}, duration: {api_duration:.2f}s")
    
    def end_processing(self, db: Session, job_id: str, status: str = "completed", image_id: Optional[str] = None) -> Dict[str, Any]:
        """Record the end of processing and return the stats"""
        processing = db.query(ImageProcessing).filter_by(job_id=job_id).first()
        if processing:
            end_time = self._get_utc_now()
            # Ensure both timestamps are timezone-aware
            if processing.start_time.tzinfo is None:
                processing.start_time = processing.start_time.replace(tzinfo=timezone.utc)
            
            # Calculate total duration from start to end
            duration = (end_time - processing.start_time).total_seconds()
            
            processing.end_time = end_time
            processing.duration_seconds = round(duration, 2)
            processing.status = status
            if image_id:
                processing.image_id = image_id
            
            db.commit()
            logger.info(f"Completed job {job_id} in {duration:.2f}s with status {status}")
            return processing.to_dict()
        logger.warning(f"No processing record found for job {job_id}")
        return {}
    
    def get_stats(self, db: Session, job_id: str) -> Dict[str, Any]:
        """Get stats for a job"""
        processing = db.query(ImageProcessing).filter_by(job_id=job_id).first()
        if processing:
            return processing.to_dict()
        return {}

    def get_image_stats(self, db: Session, image_id: str) -> Dict[str, Any]:
        """Get all stats for an image, including all processing records"""
        image = db.query(Image).filter_by(id=image_id).first()
        if not image:
            return {}
        
        return {
            "image_id": str(image.id),
            "filename": image.filename,
            "uploaded_at": image.uploaded_at.isoformat() if image.uploaded_at else None,
            "processings": [proc.to_dict() for proc in image.processings]
        }
    
    def cleanup_stats(self, db: Session, job_id: str) -> None:
        """Remove stats for completed job"""
        processing = db.query(ImageProcessing).filter_by(job_id=job_id).first()
        if processing:
            db.delete(processing)
            db.commit()
            logger.info(f"Cleaned up stats for job {job_id}")

# Global instance
sync_stats = SyncProcessingStats() 