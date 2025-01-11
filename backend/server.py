from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from celery.result import AsyncResult
import os
from process_images import process_image
import uuid
from typing import List, Set
from dotenv import load_dotenv
import imghdr

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGINS", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Track processed filenames to prevent duplicates
processed_files: Set[str] = set()

def is_valid_image(file_path: str) -> bool:
    """Check if the file is a valid image"""
    try:
        # Check if it's a recognized image format
        image_type = imghdr.what(file_path)
        return image_type is not None
    except Exception as e:
        print(f"[Server] Error validating image {file_path}: {str(e)}")
        return False

def is_valid_file(filename: str) -> bool:
    """Check if the file should be processed"""
    # Skip macOS metadata files
    if filename.startswith("._"):
        print(f"[Server] Skipping macOS metadata file: {filename}")
        return False
    # Skip hidden files
    if filename.startswith("."):
        print(f"[Server] Skipping hidden file: {filename}")
        return False
    # Skip already processed files
    if filename in processed_files:
        print(f"[Server] Skipping duplicate file: {filename}")
        return False
    # Skip files without extensions
    if not os.path.splitext(filename)[1]:
        print(f"[Server] Skipping file without extension: {filename}")
        return False
    return True

@app.post("/api/process-images")
async def upload_images(files: List[UploadFile] = File(...)):
    print(f"[Server] Received {len(files)} files")
    print(f"[Server] File names: {[f.filename for f in files]}")
    jobs = []
    
    # Clear processed files set at the start of each upload
    processed_files.clear()
    
    for file in files:
        try:
            # Skip files without filename
            if not file.filename:
                print("[Server] Skipping file with no filename")
                continue

            # Skip invalid files
            if not is_valid_file(file.filename):
                continue
                
            # Generate unique filename
            file_extension = os.path.splitext(str(file.filename))[1].lower()
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            
            print(f"[Server] Processing file: {file.filename} -> {unique_filename}")
            
            # Save file
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            # Validate the saved file is an actual image
            if not is_valid_image(file_path):
                print(f"[Server] Invalid image file: {file.filename}")
                os.remove(file_path)
                continue
            
            # Mark file as processed
            processed_files.add(str(file.filename))
            
            # Start processing task
            task = process_image.delay(file_path, file.filename)
            print(f"[Server] Created job {task.id} for file {file.filename}")
            jobs.append({
                "job_id": task.id,
                "filename": file.filename
            })
            
        except Exception as e:
            print(f"[Server] Error processing file {file.filename}: {str(e)}")
            # Clean up file if it was saved
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=500, detail=str(e))
    
    print(f"[Server] Successfully created {len(jobs)} jobs")
    print(f"[Server] Job details: {jobs}")
    return {"jobs": jobs}

@app.get("/api/job-status/{job_id}")
async def get_job_status(job_id: str):
    try:
        result = AsyncResult(job_id)
        
        if result.state == 'SUCCESS':
            print(f"[Server] Returning SUCCESS response for job {job_id}: {result.result}")
            return result.result
        elif result.state == 'FAILURE':
            error_info = {
                "status": "error",
                "job_id": job_id,
                "error": str(result.result) if result.result else "Task failed"
            }
            print(f"[Server] Returning FAILURE response for job {job_id}: {error_info}")
            return error_info
        else:
            progress_info = result.info or {
                "status": "processing",
                "job_id": job_id
            }
            print(f"[Server] Returning PROGRESS response for job {job_id}: {progress_info}")
            return progress_info
            
    except Exception as e:
        print(f"[Server] Error getting status for job {job_id}: {str(e)}")
        return {
            "status": "error",
            "job_id": job_id,
            "error": str(e)
        }
