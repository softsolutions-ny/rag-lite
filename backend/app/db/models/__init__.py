from app.db.base import Base
from app.db.models.image import Image, ImageProcessing

# Import all models here for Alembic autogenerate support
__all__ = ["Base", "Image", "ImageProcessing"]
