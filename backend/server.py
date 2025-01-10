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
        
        # Create job ID and submit to queue
        job_id = str(uuid.uuid4())
        process_image.delay(file_path, job_id)
        job_ids.append({"job_id": job_id, "filename": file.filename})
    
    return JSONResponse(content={"jobs": job_ids})

@app.get("/api/job-status/{job_id}")
async def get_job_status(job_id: str):
    result = AsyncResult(job_id)
    
    if result.ready():
        return result.get()
    
    return {
        "status": "processing",
        "job_id": job_id,
        "result": None,
        "error": None
    }

@app.on_event("startup")
async def startup_event():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
