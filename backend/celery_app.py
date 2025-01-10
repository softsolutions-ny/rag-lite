from celery import Celery
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Celery with Redis backend
celery_app = Celery('tasks')

# Configure Celery
celery_app.conf.update(
    broker_url=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    result_backend=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    imports=['process_images']
) 