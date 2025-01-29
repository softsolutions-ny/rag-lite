from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logger
from app.api.v1.router import api_router

# Set up logging
logger = setup_logger("main")

app = FastAPI(title="Elucide API")

# Add root endpoint here
@app.get("/")
async def root():
    return {"status": "OK", "service": "Elucide API", "version": "0.1.0"}

# Configure CORS with settings
origins = settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS else ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include API router
app.include_router(api_router, prefix="/api/v1") 