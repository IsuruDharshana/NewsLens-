from fastapi import APIRouter
from app.services.pipeline_service import pipeline

router = APIRouter()


@router.post("/trigger")
async def trigger_pipeline():
    """Manually trigger the news pipeline (for demo/testing)."""
    stats = await pipeline.run()
    return {
        "status": stats.get("status", "unknown"),
        "articles_fetched": stats.get("articles_fetched", 0),
        "articles_stored": stats.get("articles_stored", 0),
        "clusters_created": stats.get("clusters_created", 0),
        "errors": stats.get("errors", []),
    }


@router.get("/status")
async def pipeline_status():
    """Get current pipeline status and last run stats."""
    return pipeline.get_status()
