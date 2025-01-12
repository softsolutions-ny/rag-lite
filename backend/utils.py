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
    if result.state == "SUCCESS":
        return result.result  # Our tasks already return properly formatted results
    elif result.state == "FAILURE":
        return {
            "status": "error",
            "job_id": job_id,
            "error": str(result.result) if result.result else "Task failed"
        }
    else:
        return result.info or {
            "status": "processing",
            "job_id": job_id
        }
