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
celery_app = Celery('tasks')

# Configure Celery
celery_app.conf.update(
    broker_url=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    result_backend=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    task_serializer='custom_json',
    accept_content=['custom_json'],
    result_serializer='custom_json',
    timezone='UTC',
    enable_utc=True,
    imports=['process_images']
) 