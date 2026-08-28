from fastapi import APIRouter

router = APIRouter()


@router.post("/trigger")
async def trigger_pipeline():
    """Manually trigger the news pipeline (for demo/testing)."""
    # TODO: Connect to LangGraph pipeline
    return {
        "status": "not_implemented",
        "message": "Pipeline not implemented yet. Will be built in Prompt 7.",
    }


@router.get("/status")
async def pipeline_status():
    """Get current pipeline status and last run stats."""
    # TODO: Connect to pipeline state
    return {
        "status": "idle",
        "last_run": None,
        "articles_processed": 0,
        "clusters_created": 0,
    }
