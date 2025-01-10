from openai import OpenAI
import os
from dotenv import load_dotenv
from celery_app import celery_app
import base64
from typing import Dict, Any
import httpx
from stats import stats  # Import the stats module

# Load environment variables
load_dotenv()

@celery_app.task(bind=True)
def process_image(self, image_path: str, filename: str) -> Dict[str, Any]:
    job_id = self.request.id  # Get the Celery task ID
    # Start timing
    stats.start_processing(job_id, filename)
    print(f"[Process] Starting image processing for job {job_id}")
    
    # Update initial state
    self.update_state(state='PROGRESS', meta={
        'status': 'processing',
        'job_id': job_id,
        'filename': filename
    })
    
    try:
        # Initialize OpenAI client inside the task
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        
        # Verify the image exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Create a basic HTTP client without proxies
        http_client = httpx.Client()
        client = OpenAI(
            api_key=api_key,
            http_client=http_client
        )
        
        # Read and encode the image
        with open(image_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
        
        # Call OpenAI Vision API
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Please analyze this image and provide a detailed description."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=500
        )
        
        # Clean up
        http_client.close()
        
        # Clean up the image file after successful processing
        try:
            os.remove(image_path)
        except Exception as e:
            print(f"Warning: Could not remove image file {image_path}: {e}")
        
        # Get processing stats
        processing_stats = stats.end_processing(job_id)
        print(f"[Process] Got processing stats for job {job_id}: {processing_stats}")
            
        result = {
            "status": "completed",
            "job_id": job_id,
            "filename": filename,
            "result": response.choices[0].message.content,
            "error": None,
            "processing_time": processing_stats.get("duration_seconds")
        }
        print(f"[Process] Returning result with processing time: {result['processing_time']}")
        
        # Update final state
        self.update_state(state='SUCCESS', meta=result)
        return result
        
    except Exception as e:
        error_msg = f"Error processing image: {str(e)}"
        print(f"[Process] Error in job {job_id}: {error_msg}")
        
        # Record error in stats
        stats.end_processing(job_id, status="error")
        
        # Clean up the image on error
        try:
            os.remove(image_path)
        except Exception:
            pass
            
        error_result = {
            "status": "error",
            "job_id": job_id,
            "filename": filename,
            "result": None,
            "error": error_msg
        }
        
        # Update error state
        self.update_state(state='FAILURE', meta=error_result)
        return error_result
