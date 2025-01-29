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
default_origins = [
    "http://localhost:3000",  # Keep local development
    "https://elucide.vercel.app",  # Main production domain
    "https://*.vercel.app",  # Broader wildcard for all Vercel deployments
]

# Parse CORS origins from settings and ensure localhost:3000 is included for development
origins = settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS else default_origins
origins = [origin.strip() for origin in origins]  # Clean up any whitespace
if "http://localhost:3000" not in origins:
    origins.append("http://localhost:3000")

# Add CORS middleware with explicit configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Credentials",
    ],
    expose_headers=[
        "Content-Type",
        "Authorization",
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Credentials",
    ],
    max_age=86400,  # Cache preflight requests for 24 hours
)

# Include API router
app.include_router(api_router, prefix="/api/v1") 