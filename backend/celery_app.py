from app.core.celery_app import celery_app

# This re-exports the celery app at the root level
__all__ = ('celery_app',)