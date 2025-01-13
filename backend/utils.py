import os
import imghdr
import uuid
from typing import Optional, Dict, Any
from celery.result import AsyncResult
from PIL import Image
import io

def generate_unique_filename(original_filename: str) -> str:
    """
    Generate a unique filename, preserving the extension from the original.
    """
    extension = os.path.splitext(original_filename)[1].lower()
    return f"{uuid.uuid4()}{extension}"

def is_valid_file(filename: str) -> bool:
    """Check if the file has a valid extension."""
    valid_extensions = {'.jpg', '.jpeg', '.png', '.gif'}
    return os.path.splitext(filename)[1].lower() in valid_extensions

def is_valid_image(fpath: str) -> bool:
    """Check if the file is a valid image using both imghdr and PIL."""
    try:
        # First check with imghdr
        if imghdr.what(fpath) is None:
            return False
            
        # Then validate with PIL
        with Image.open(fpath) as img:
            # Convert to RGB if necessary (handles RGBA, etc.)
            if img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            # Validate by saving to memory
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='JPEG')
            return True
    except Exception:
        return False

def parse_celery_result(job_id: str, result: AsyncResult) -> Dict[str, Any]:
    """
    Parse a Celery AsyncResult into a standardized response format.
    """
    try:
        # Check if task exists
        if not result:
            return {
                "status": "error",
                "job_id": job_id,
                "error": "Task not found"
            }
            
        # Get task state
        state = result.state
        
        if state == "SUCCESS":
            return result.get()  # Our tasks already return properly formatted results
        elif state == "FAILURE":
            return {
                "status": "error",
                "job_id": job_id,
                "error": str(result.result) if result.result else "Task failed"
            }
        elif state == "STARTED":
            return {
                "status": "processing",
                "job_id": job_id,
                "state": "started"
            }
        elif state == "PENDING":
            return {
                "status": "pending",
                "job_id": job_id
            }
        else:  # PROGRESS or other states
            info = result.info
            if isinstance(info, dict):
                return info
            return {
                "status": "processing",
                "job_id": job_id,
                "state": state.lower()
            }
    except Exception as e:
        return {
            "status": "error",
            "job_id": job_id,
            "error": f"Error getting task status: {str(e)}"
        }
