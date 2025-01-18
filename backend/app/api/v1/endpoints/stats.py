from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from celery.result import AsyncResult
from app.core.security import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_db
from app.utils.helpers import parse_celery_result
from app.core.logging import setup_logger
from app.services.stats_service import stats

# Set up logging
logger = setup_logger("stats")

router = APIRouter()

@router.get("/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get job status and results"""
    try:
        result = AsyncResult(job_id)
        celery_result = parse_celery_result(job_id, result)
        
        # Add processing details if available
        processing_stats = await stats.get_stats(db, job_id)
        if processing_stats:
            celery_result.update({"processing_details": processing_stats})
        
        return celery_result
    except Exception as e:
        logger.error(f"Error getting status for job {job_id}: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "job_id": job_id,
            "error": str(e)
        } 