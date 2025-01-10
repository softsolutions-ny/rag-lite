from openai import OpenAI
import os
from dotenv import load_dotenv
from celery_app import celery_app
import base64
from typing import Dict, Any
import httpx

# Load environment variables
load_dotenv()

@celery_app.task
def process_image(image_path: str, job_id: str) -> Dict[str, Any]:
    try:
        # Initialize OpenAI client inside the task
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        
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
        
        # Clean up the HTTP client
        http_client.close()
        
        return {
            "status": "completed",
            "job_id": job_id,
            "result": response.choices[0].message.content,
            "error": None
        }
        
    except Exception as e:
        return {
            "status": "error",
            "job_id": job_id,
            "result": None,
            "error": str(e)
        }
