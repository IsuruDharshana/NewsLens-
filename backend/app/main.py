import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.routes import news, auth, user, pipeline as pipeline_router, engage as engage_router, admin as admin_router
from app.services.pipeline_service import pipeline

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def scheduled_pipeline_run():
    """Scheduled pipeline trigger."""
    logger.info("Scheduled pipeline run triggered")
    await pipeline.run()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("NewsLens backend starting up...")
    logger.info(f"Environment: {settings.app_env}")
    logger.info(f"Pipeline interval: {settings.pipeline_interval_minutes} minutes")

    # Start scheduled pipeline runs (first run after interval, not immediately)
    from datetime import datetime, timedelta, timezone
    scheduler.add_job(
        scheduled_pipeline_run,
        "interval",
        minutes=settings.pipeline_interval_minutes,
        id="news_pipeline",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc) + timedelta(minutes=settings.pipeline_interval_minutes),
    )
    scheduler.start()
    logger.info("Scheduler started")

    yield

    scheduler.shutdown(wait=False)
    logger.info("NewsLens backend shutting down...")


app = FastAPI(
    title="NewsLens API",
    description="AI-Powered Multi-Agent News Aggregation System for Sri Lanka",
    version="0.2.0",
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
app.include_router(pipeline_router.router, prefix="/api/pipeline", tags=["pipeline"])
app.include_router(engage_router.router, prefix="/api", tags=["engage"])
app.include_router(admin_router.router, prefix="/api", tags=["admin"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "newslens", "version": "0.2.0"}
