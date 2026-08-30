import asyncio
from fastapi import APIRouter
from app.services.pipeline_service import pipeline

router = APIRouter()


@router.post("/trigger")
async def trigger_pipeline():
    """Trigger the pipeline in the background. Returns immediately."""
    if pipeline.is_running:
        return {
            "status": "already_running",
            "message": "Pipeline is already running. Check /api/pipeline/status for progress.",
            "current_step": pipeline.current_step,
            "progress": pipeline.progress,
        }

    # Run in background — don't block the response
    asyncio.create_task(pipeline.run())

    return {
        "status": "triggered",
        "message": "Pipeline started. Poll /api/pipeline/status for progress.",
    }


@router.get("/status")
async def pipeline_status():
    """Get current pipeline status and last run stats."""
    return pipeline.get_status()
