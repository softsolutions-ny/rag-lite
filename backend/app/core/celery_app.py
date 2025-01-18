from celery import Celery
import os
from dotenv import load_dotenv
from kombu.serialization import register
import json
from uuid import UUID

load_dotenv()

# Custom JSON encoder to handle UUID and other types
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)

# Register the custom encoder
def custom_dumps(obj):
    return json.dumps(obj, cls=CustomJSONEncoder)

def custom_loads(obj):
    return json.loads(obj)

# Register our custom serializer
register('custom_json', custom_dumps, custom_loads,
         content_type='application/x-custom-json',
         content_encoding='utf-8')

# Initialize Celery with Redis backend
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
celery_app = Celery(
    'tasks',
    broker=redis_url,
    backend='redis'  # Just specify the backend type
)

# Configure Celery
celery_app.conf.update(
    broker_url=redis_url,
    result_backend=redis_url,
    task_serializer='custom_json',
    accept_content=['custom_json', 'application/json', 'json'],  # Accept more content types
    result_serializer='custom_json',
    result_expires=None,  # Results don't expire
    task_track_started=True,  # Track when tasks are started
    task_ignore_result=False,  # Don't ignore results
    timezone='UTC',
    enable_utc=True,
    imports=['app.services.image_service']  # Updated import path
) 