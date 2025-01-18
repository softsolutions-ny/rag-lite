from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List, Dict, Any
import uuid
import os
from app.core.security import get_current_user
from app.core.config import settings
from app.db.repositories.storage import StorageManager
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_db
from app.utils.helpers import is_valid_file, is_valid_image, generate_unique_filename
from app.core.logging import setup_logger
from app.services.image_service import process_image
from app.services.stats_service import stats

# Set up logging
logger = setup_logger("images")

router = APIRouter()

@router.post("/")
async def upload_images(
    files: List[UploadFile] = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload and process images"""
    logger.info(f"Received {len(files)} files")
    logger.info(f"File names: {[f.filename for f in files]}")
    jobs = []
    
    storage = StorageManager(db)
    
    for file in files:
        try:
            if not file.filename:
                logger.warning("Skipping file with no filename")
                continue

            if not is_valid_file(file.filename):
                continue
                
            # Generate unique filename
            unique_filename = generate_unique_filename(file.filename)
            file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
            
            logger.info(f"Processing file: {file.filename} -> {unique_filename}")
            
            # Save file
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            if not is_valid_image(file_path):
                logger.warning(f"Invalid image file: {file.filename}")
                os.remove(file_path)
                continue
            
            # Start processing task
            task = process_image.delay(file_path, file.filename, current_user["user_id"])
            logger.info(f"Created job {task.id} for file {file.filename}")
            jobs.append({
                "job_id": task.id,
                "filename": file.filename
            })
            
        except Exception as e:
            logger.error(f"Error processing file {file.filename}: {str(e)}", exc_info=True)
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info(f"Successfully created {len(jobs)} jobs")
    return {"jobs": jobs}

@router.get("/{image_id}")
async def get_image(
    image_id: uuid.UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get image details by ID"""
    storage = StorageManager(db)
    result = await storage.get_image_with_analysis(image_id)
    if not result:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Add processing history
    image_stats = await stats.get_image_stats(db, str(image_id))
    if image_stats:
        result["processing_history"] = image_stats["processings"]
    
    return result

@router.get("/")
async def list_images(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all images for the current user"""
    storage = StorageManager(db)
    return await storage.get_user_images(current_user["user_id"])

@router.delete("/{image_id}")
async def delete_image(
    image_id: uuid.UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an image and its analysis"""
    storage = StorageManager(db)
    if await storage.delete_image(image_id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Image not found") 