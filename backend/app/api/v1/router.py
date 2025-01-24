from fastapi import APIRouter
from app.api.v1.endpoints import images, stats, chat, extraction

api_router = APIRouter()

api_router.include_router(images.router, prefix="/images", tags=["images"])
api_router.include_router(stats.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(extraction.router, prefix="/extraction", tags=["extraction"]) 