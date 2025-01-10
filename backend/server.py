from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import uuid
from typing import List
import aiofiles
from process_images import process_image
from celery.result import AsyncResult
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="RAG-Lite API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")

@app.get("/")
async def root():
    return {"message": "RAG-Lite API is running"}

@app.post("/api/process-images")
async def upload_images(files: List[UploadFile] = File(...)):
    job_ids = []
    
    for file in files:
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        # Submit to queue using task ID as job ID
        task = process_image.delay(file_path, file.filename)
        print(f"[Server] Created task with ID: {task.id}")
        job_ids.append({"job_id": task.id, "filename": file.filename})
    
    return JSONResponse(content={"jobs": job_ids})

@app.get("/api/job-status/{job_id}")
async def get_job_status(job_id: str):
    result = AsyncResult(job_id)
    
    if result.state == 'SUCCESS':
        # Return the actual result for completed tasks
        response = result.get()
        print(f"[Server] Returning SUCCESS response for job {job_id}: {response}")
    elif result.state == 'FAILURE':
        response = {
            "status": "error",
            "job_id": job_id,
            "filename": result.info.get('filename') if result.info else None,
            "result": None,
            "error": str(result.info) if result.info else "Task failed"
        }
        print(f"[Server] Returning FAILURE response for job {job_id}: {response}")
    else:
        # For PROGRESS or PENDING state
        response = result.info if result.info else {
            "status": "processing",
            "job_id": job_id,
            "filename": None,
            "result": None,
            "error": None
        }
        print(f"[Server] Returning {result.state} response for job {job_id}: {response}")
    
    return response

@app.on_event("startup")
async def startup_event():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
