import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import news, auth, user, pipeline

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("NewsLens backend starting up...")
    logger.info(f"Environment: {settings.app_env}")
    logger.info(f"Pipeline interval: {settings.pipeline_interval_minutes} minutes")
    yield
    logger.info("NewsLens backend shutting down...")


app = FastAPI(
    title="NewsLens API",
    description="AI-Powered Multi-Agent News Aggregation System for Sri Lanka",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS - allow Expo dev server and web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(news.router, prefix="/api/news", tags=["news"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(user.router, prefix="/api/user", tags=["user"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["pipeline"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "newslens"}
