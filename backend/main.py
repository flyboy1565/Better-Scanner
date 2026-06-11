from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import os
import logging
from pathlib import Path

from app.core.config import settings
from app.api.endpoints import router

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Better Scanner API",
    description="FastAPI backend for multi-photo document scanning with Immich integration",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add GZIP compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include routers
app.include_router(router)


@app.on_event("startup")
async def startup_event():
    """Log startup information"""
    logger.info("=" * 60)
    logger.info("🚀 Better Scanner API Starting")
    logger.info(f"Server: {settings.SERVER_HOST}:{settings.SERVER_PORT}")
    logger.info(f"Debug Mode: {settings.DEBUG}")
    logger.info(f"Immich Enabled: {settings.IMMICH_ENABLED}")
    if settings.IMMICH_ENABLED:
        logger.info(f"Immich Server: {settings.IMMICH_SERVER_URL}")
    logger.info(f"Target Directory: {settings.TARGET_DIR}")
    logger.info("=" * 60)


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Better Scanner API",
    }


@app.get("/config")
def get_config():
    """Get non-sensitive configuration"""
    return {
        "immich_enabled": settings.IMMICH_ENABLED,
        "immich_server": settings.IMMICH_SERVER_URL if settings.IMMICH_ENABLED else None,
        "target_dir": settings.TARGET_DIR,
        "debug": settings.DEBUG,
    }


if __name__ == "__main__":
    import uvicorn

    # Ensure target directory exists
    os.makedirs(settings.TARGET_DIR, exist_ok=True)

    uvicorn.run(
        "main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG,
    )
