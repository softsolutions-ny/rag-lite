from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, HttpUrl
from app.core.security import get_current_user
from app.services.extraction_service import extract_data, create_extraction_schema
from app.core.logging import setup_logger
from celery.result import AsyncResult

# Set up logging
logger = setup_logger("extraction_endpoints")

router = APIRouter()

class ExtractionRequest(BaseModel):
    """Model for extraction request"""
    urls: List[str]
    prompt: Optional[str] = None
    extraction_schema: Optional[Dict[str, Any]] = None
    enable_web_search: bool = False

class ExtractionResponse(BaseModel):
    """Model for extraction response"""
    job_id: str
    status: str
    message: str

@router.post("/extract", response_model=ExtractionResponse)
async def create_extraction(
    request: ExtractionRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Start an extraction job
    """
    try:
        # Validate URLs
        if not request.urls:
            raise HTTPException(status_code=400, detail="No URLs provided")
            
        # Start Celery task
        task = extract_data.delay(
            urls=request.urls,
            prompt=request.prompt,
            schema=request.extraction_schema,
            enable_web_search=request.enable_web_search,
            user_id=current_user["user_id"]
        )
        
        return ExtractionResponse(
            job_id=task.id,
            status="pending",
            message="Extraction job started successfully"
        )
        
    except Exception as e:
        logger.error(f"Error creating extraction job: {str(e)}")
        logger.error(f"Request data: {request.dict()}")
        logger.error(f"Current user data: {current_user}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/extract/{job_id}", response_model=Dict[str, Any])
async def get_extraction_status(
    job_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """
    Get the status of an extraction job
    """
    try:
        task_result = AsyncResult(job_id)
        
        if task_result.ready():
            if task_result.successful():
                return {
                    "status": "completed",
                    "data": task_result.get()
                }
            else:
                return {
                    "status": "failed",
                    "error": str(task_result.result)
                }
        else:
            return {
                "status": "processing",
                "progress": task_result.info
            }
            
    except Exception as e:
        logger.error(f"Error getting extraction status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 