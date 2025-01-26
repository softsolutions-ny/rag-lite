from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Body
from typing import List, Dict, Any
import uuid
import os
from app.core.security import get_current_user
from app.core.config import settings, get_sync_db
from app.db.repositories.sync_storage import SyncStorageManager
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_db
from app.utils.helpers import is_valid_file, is_valid_image, generate_unique_filename
from app.core.logging import setup_logger
from app.services.image_service import upload_image, analyze_image
from app.services.stats_service import sync_stats
from app.db.models.image import Image
import httpx

# Set up logging
logger = setup_logger("images")

router = APIRouter()

@router.post("/")
async def upload_images(
    files: List[UploadFile] = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload images and return their public URLs"""
    logger.info(f"Received {len(files)} files")
    results = []
    
    # Use sync session for storage operations
    sync_db = next(get_sync_db())
    try:
        storage = SyncStorageManager(sync_db)
        
        for file in files:
            try:
                if not file.filename:
                    continue

                if not is_valid_file(file.filename):
                    continue
                    
                # Generate unique filename
                unique_filename = generate_unique_filename(file.filename)
                file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
                
                # Save file temporarily
                content = await file.read()
                with open(file_path, "wb") as f:
                    f.write(content)
                
                if not is_valid_image(file_path):
                    os.remove(file_path)
                    continue

                # Generate GCS key
                image_id = uuid.uuid4()
                gcs_key = f"users/{current_user['user_id']}/images/{image_id}/{unique_filename}"
                
                # Upload to GCS
                bucket = storage.bucket
                blob = bucket.blob(gcs_key)
                blob.content_type = "image/jpeg"
                blob.cache_control = "public, max-age=31536000"
                blob.upload_from_filename(file_path, predefined_acl='publicRead')
                
                # Create database record
                image = Image(
                    id=image_id,
                    filename=file.filename,
                    storage_path=gcs_key,
                    user_id=current_user["user_id"]
                )
                sync_db.add(image)
                sync_db.commit()
                
                # Return the public URL
                public_url = f"https://storage.googleapis.com/elucide/{gcs_key}"
                results.append({
                    "id": str(image_id),
                    "filename": file.filename,
                    "url": public_url
                })
                
            except Exception as e:
                logger.error(f"Error processing file {file.filename}: {str(e)}", exc_info=True)
                if 'file_path' in locals() and os.path.exists(file_path):
                    os.remove(file_path)
                continue
            finally:
                if 'file_path' in locals() and os.path.exists(file_path):
                    os.remove(file_path)
                    
        return {"images": results}
    finally:
        sync_db.close()

@router.post("/{image_id}/analyze")
async def analyze_image_endpoint(
    image_id: uuid.UUID,
    prompt: str = Body(..., embed=True),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Analyze an image with a user-provided prompt"""
    logger.info(f"Analyzing image {image_id} with prompt: {prompt}")
    
    # Use sync session for storage operations
    sync_db = next(get_sync_db())
    try:
        storage = SyncStorageManager(sync_db)
        
        # Verify image exists and belongs to user
        image = storage.get_image_with_analysis(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Start analysis task
        task = analyze_image.delay(str(image_id), prompt)
        logger.info(f"Created analysis job {task.id} for image {image_id}")
        
        return {
            "job_id": task.id,
            "image_id": str(image_id)
        }
    finally:
        sync_db.close()

@router.get("/{image_id}")
async def get_image(
    image_id: uuid.UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get image details by ID"""
    # Use sync session for storage operations
    sync_db = next(get_sync_db())
    try:
        storage = SyncStorageManager(sync_db)
        result = storage.get_image_with_analysis(image_id)
        if not result:
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Add processing history using sync stats
        image_stats = sync_stats.get_image_stats(sync_db, str(image_id))
        if image_stats:
            result["processing_history"] = image_stats["processings"]
        
        return result
    finally:
        sync_db.close()

@router.get("/")
async def list_images(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all images for the current user"""
    sync_db = next(get_sync_db())
    try:
        storage = SyncStorageManager(sync_db)
        return storage.get_user_images(current_user["user_id"])
    finally:
        sync_db.close()

@router.delete("/{image_id}")
async def delete_image(
    image_id: uuid.UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an image and its analysis"""
    sync_db = next(get_sync_db())
    try:
        storage = SyncStorageManager(sync_db)
        if storage.delete_image(image_id):
            return {"status": "success"}
        raise HTTPException(status_code=404, detail="Image not found")
    finally:
        sync_db.close()

@router.post("/analyze")
async def analyze_image_direct(
    request: Dict[str, str] = Body(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Analyze an image directly with OpenAI Vision using the URL and prompt"""
    url = request.get("url")
    prompt = request.get("prompt")
    
    if not url or not prompt:
        raise HTTPException(status_code=400, detail="URL and prompt are required")
        
    logger.info(f"Analyzing image at URL: {url} with prompt: {prompt}")
    
    try:
        # Call OpenAI Vision API directly
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v1"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": prompt
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": url,
                                        "detail": "low"
                                    }
                                }
                            ]
                        }
                    ],
                    "max_tokens": 500
                },
                timeout=30.0
            )
            
            response.raise_for_status()
            result = response.json()
            
            analysis = result["choices"][0]["message"]["content"]
            logger.info(f"Analysis completed successfully")
            
            return {
                "analysis": analysis
            }
                
    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) 