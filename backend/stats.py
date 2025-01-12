from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from db.models import JobStats
from logger import setup_logger

# Set up logging
logger = setup_logger("stats")

class ProcessingStats:
    def __init__(self):
        """Initialize ProcessingStats"""
        pass
    
    def _get_utc_now(self) -> datetime:
        """Get current UTC timestamp"""
        return datetime.now(timezone.utc)
    
    def start_processing(self, db: Session, job_id: str, user_id: str) -> None:
        """Record the start of processing for a job"""
        stats = JobStats(
            job_id=job_id,
            user_id=user_id,
            start_time=self._get_utc_now(),
            status="processing"
        )
        db.add(stats)
        db.commit()
        logger.info(f"Started processing job {job_id}")
    
    def start_api_call(self, db: Session, job_id: str) -> None:
        """Record the start of the API call"""
        stats = db.query(JobStats).filter_by(job_id=job_id).first()
        if stats:
            stats.api_start_time = self._get_utc_now()
            db.commit()
            logger.info(f"Started API call for job {job_id}")
    
    def end_api_call(self, db: Session, job_id: str) -> None:
        """Record the end of the API call"""
        stats = db.query(JobStats).filter_by(job_id=job_id).first()
        if stats and stats.api_start_time:
            api_end_time = self._get_utc_now()
            # Ensure both timestamps are timezone-aware
            if stats.api_start_time.tzinfo is None:
                stats.api_start_time = stats.api_start_time.replace(tzinfo=timezone.utc)
            
            api_duration = (api_end_time - stats.api_start_time).total_seconds()
            
            stats.api_end_time = api_end_time
            stats.api_duration_seconds = round(api_duration, 2)
            db.commit()
            logger.info(f"Ended API call for job {job_id}, duration: {api_duration:.2f}s")
    
    def end_processing(self, db: Session, job_id: str, status: str = "completed", image_id: Optional[str] = None) -> Dict[str, Any]:
        """Record the end of processing and return the stats"""
        stats = db.query(JobStats).filter_by(job_id=job_id).first()
        if stats:
            end_time = self._get_utc_now()
            # Ensure both timestamps are timezone-aware
            if stats.start_time.tzinfo is None:
                stats.start_time = stats.start_time.replace(tzinfo=timezone.utc)
            
            # Calculate total duration from start to end
            duration = (end_time - stats.start_time).total_seconds()
            
            stats.end_time = end_time
            stats.duration_seconds = round(duration, 2)
            stats.status = status
            if image_id:
                stats.image_id = image_id
            
            db.commit()
            logger.info(f"Completed job {job_id} in {duration:.2f}s with status {status}")
            return stats.to_dict()
        logger.warning(f"No stats found for job {job_id}")
        return {}
    
    def get_stats(self, db: Session, job_id: str) -> Dict[str, Any]:
        """Get stats for a job"""
        stats = db.query(JobStats).filter_by(job_id=job_id).first()
        if stats:
            return stats.to_dict()
        return {}
    
    def cleanup_stats(self, db: Session, job_id: str) -> None:
        """Remove stats for completed job"""
        stats = db.query(JobStats).filter_by(job_id=job_id).first()
        if stats:
            db.delete(stats)
            db.commit()
            logger.info(f"Cleaned up stats for job {job_id}")

# Global instance
stats = ProcessingStats() 