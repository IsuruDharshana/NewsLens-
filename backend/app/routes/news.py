import logging

from fastapi import APIRouter, Query, HTTPException, Header
from typing import Optional

from app.models.schemas import (
    PaginatedResponse,
    ClusterResponse,
    ClusterListItem,
    QueryRequest,
    QueryResponse,
    SourceInfo,
)
from app.services.supabase_service import supabase_service
from app.services.llm_service import llm_service
from app.services.chroma_service import chroma_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _cluster_to_list_item(cluster: dict, engagement: dict | None = None, image_url: str | None = None) -> dict:
    """Convert a cluster DB row to a ClusterListItem response."""
    eng = engagement or {}
    return {
        "id": cluster["id"],
        "title": cluster.get("title"),
        "summary": cluster.get("summary"),
        "source_count": cluster.get("source_count", 0),
        "category": cluster.get("category", "Politics"),
        "is_breaking": cluster.get("is_breaking", False),
        "confidence_score": cluster.get("confidence_score", 0.0),
        "trend_score": cluster.get("trend_score", 0.0),
        "top_sources": [],  # populated separately if needed
        "like_count": eng.get("like_count", 0),
        "comment_count": eng.get("comment_count", 0),
        "image_url": image_url,
        "published_at": cluster.get("published_at"),
    }


async def _maybe_translate_summaries(clusters: list[dict], lang: str | None) -> list[dict]:
    """If lang=si, translate all cluster summaries to Sinhala in one batched call."""
    if lang != "si" or not clusters:
        return clusters

    summaries = [c.get("summary", "") or "" for c in clusters]
    if not any(s.strip() for s in summaries):
        return clusters

    try:
        translated = await llm_service.translate_to_sinhala_batch(summaries)
        for i, t in enumerate(translated):
            if t:
                clusters[i]["summary"] = t
    except Exception as e:
        logger.warning(f"Sinhala translation failed, falling back to English: {e}")

    return clusters


@router.get("", response_model=PaginatedResponse)
async def get_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    lang: Optional[str] = None,
):
    """Get paginated news feed, optionally filtered by category. Pass lang=si for Sinhala summaries."""
    clusters, total = await supabase_service.get_clusters(
        page=page, limit=limit, category=category
    )
    clusters = await _maybe_translate_summaries(clusters, lang)
    # Fetch engagement counts + representative image for all clusters in batch
    cluster_ids = [c["id"] for c in clusters]
    engagement = supabase_service.get_engagement_counts_batch(cluster_ids)
    images = supabase_service.get_representative_images(cluster_ids)
    return {
        "data": [
            _cluster_to_list_item(c, engagement.get(c["id"]), images.get(c["id"]))
            for c in clusters
        ],
        "pagination": {"page": page, "limit": limit, "total": total},
    }


@router.get("/trending", response_model=PaginatedResponse)
async def get_trending_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Get stories sorted by trend score."""
    clusters, total = await supabase_service.get_clusters(
        page=page, limit=limit, order_by="trend_score"
    )
    cluster_ids = [c["id"] for c in clusters]
    engagement = supabase_service.get_engagement_counts_batch(cluster_ids)
    images = supabase_service.get_representative_images(cluster_ids)
    return {
        "data": [
            _cluster_to_list_item(c, engagement.get(c["id"]), images.get(c["id"]))
            for c in clusters
        ],
        "pagination": {"page": page, "limit": limit, "total": total},
    }


@router.get("/breaking", response_model=PaginatedResponse)
async def get_breaking_news(lang: Optional[str] = None):
    """Get current breaking news. Pass lang=si for Sinhala summaries."""
    clusters, total = await supabase_service.get_clusters(
        page=1, limit=10, is_breaking=True
    )
    clusters = await _maybe_translate_summaries(clusters, lang)
    cluster_ids = [c["id"] for c in clusters]
    engagement = supabase_service.get_engagement_counts_batch(cluster_ids)
    images = supabase_service.get_representative_images(cluster_ids)
    return {
        "data": [
            _cluster_to_list_item(c, engagement.get(c["id"]), images.get(c["id"]))
            for c in clusters
        ],
        "pagination": {"page": 1, "limit": 10, "total": total},
    }


@router.get("/search", response_model=PaginatedResponse)
async def search_news(
    q: str = Query(..., min_length=2, max_length=200),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
):
    """Full-text search over cluster title (weighted A) + summary (weighted B).
    Empty result sets are returned as `data: []` with HTTP 200 so the mobile
    client can render a graceful "no results" state without error handling.
    """
    query = q.strip()
    clusters, total = await supabase_service.search_clusters(query, page, limit)
    cluster_ids = [c["id"] for c in clusters]
    engagement = supabase_service.get_engagement_counts_batch(cluster_ids)
    images = supabase_service.get_representative_images(cluster_ids)
    return {
        "data": [
            _cluster_to_list_item(c, engagement.get(c["id"]), images.get(c["id"]))
            for c in clusters
        ],
        "pagination": {"page": page, "limit": limit, "total": total},
    }


@router.get("/{cluster_id}", response_model=ClusterResponse)
async def get_news_detail(cluster_id: str, lang: Optional[str] = None):
    """Get full story detail with sources and bias analysis. Pass lang=si for Sinhala summary."""
    cluster = await supabase_service.get_cluster_by_id(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Story not found")

    # Translate summary if needed
    if lang == "si" and cluster.get("summary"):
        try:
            translated = await llm_service.translate_to_sinhala_batch([cluster["summary"]])
            if translated and translated[0]:
                cluster["summary"] = translated[0]
        except Exception as e:
            logger.warning(f"Sinhala translation failed: {e}")

    # Fetch all articles in this cluster for source info
    articles = await supabase_service.get_articles_by_cluster(cluster_id)
    sources = [
        SourceInfo(
            name=a["source_name"],
            url=a["source_url"],
            bias_label=a.get("bias_label"),
        ).model_dump()
        for a in articles
    ]

    # Pick the first article with an image_url as the cluster hero image
    cluster_image_url: str | None = next(
        (a.get("image_url") for a in articles if a.get("image_url")),
        None,
    )

    return {
        "id": cluster["id"],
        "title": cluster.get("title"),
        "summary": cluster.get("summary"),
        "source_count": cluster.get("source_count", 0),
        "category": cluster.get("category", "Politics"),
        "is_breaking": cluster.get("is_breaking", False),
        "confidence_score": cluster.get("confidence_score", 0.0),
        "trend_score": cluster.get("trend_score", 0.0),
        "official_source_data": cluster.get("official_source_data"),
        "bias_analysis": cluster.get("bias_analysis"),
        "sources": sources,
        "image_url": cluster_image_url,
        "published_at": cluster.get("published_at"),
        "created_at": cluster.get("created_at"),
    }


@router.get("/personalized", response_model=PaginatedResponse)
async def get_personalized_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Get news feed filtered by user's category preferences."""
    # TODO: Read user preferences from Supabase and filter
    # For now, return all news
    clusters, total = await supabase_service.get_clusters(page=page, limit=limit)
    return {
        "data": [_cluster_to_list_item(c) for c in clusters],
        "pagination": {"page": page, "limit": limit, "total": total},
    }


# Number of articles to retrieve from ChromaDB for each RAG query
RAG_TOP_K = 5

# Max characters of each retrieved article to include in the prompt context
RAG_CONTEXT_CHARS = 600


@router.post("/query", response_model=QueryResponse)
async def query_news(request: QueryRequest):
    """RAG: Answer a natural language question using ChromaDB retrieval + Gemini.
    Returns a grounded answer plus the source articles (title, name, url) used.
    """
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # 1) Embed the question with the same model used for article embeddings
    try:
        question_embedding = await llm_service.generate_embedding(question)
    except Exception as e:
        logger.error(f"Question embedding failed: {e}")
        question_embedding = None
    if not question_embedding:
        raise HTTPException(
            status_code=503,
            detail="Embedding service unavailable. Please try again in a moment.",
        )

    # 2) Search ChromaDB for the most relevant articles
    results = None
    try:
        results = await chroma_service.search(question_embedding, n_results=RAG_TOP_K)
    except Exception as e:
        logger.error(f"ChromaDB search failed: {e}")
    docs = (results or {}).get("documents", [[]])[0] if results else []
    metas = (results or {}).get("metadatas", [[]])[0] if results else []

    if not docs:
        return {
            "question": question,
            "answer": (
                "I couldn't find any relevant articles in the news index. "
                "The index is still being built up — please run the pipeline "
                "to fetch and embed recent articles, then try again."
            ),
            "sources": [],
            "official_data": None,
        }

    # 3) Build a grounding prompt with the retrieved articles as context
    context_blocks = []
    for i, (doc, meta) in enumerate(zip(docs, metas), 1):
        meta = meta or {}
        title = meta.get("title") or "Untitled"
        source_name = meta.get("source_name") or "Unknown source"
        snippet = (doc or "")[:RAG_CONTEXT_CHARS]
        context_blocks.append(f"[{i}] ({source_name}) {title}\n{snippet}")
    context_text = "\n\n".join(context_blocks)

    prompt = f"""You are a neutral, factual news assistant for Sri Lanka.

Answer the user's question using ONLY the articles provided below.
Rules:
- Be concise (2-4 sentences).
- If the articles don't contain the answer, say: "The provided articles don't cover this question."
- Cite article numbers in brackets like [1], [2] when relevant.
- Do not add facts that are not in the articles.
- Do not editorialize or give opinions.
- Write in English.

Articles:
{context_text}

Question: {question}

Answer:"""

    # 4) Generate the grounded answer
    answer = await llm_service.generate_text(prompt)
    if not answer:
        raise HTTPException(
            status_code=503,
            detail="Answer generation failed. Please try again in a moment.",
        )

    # 5) Build a deduplicated source list (by URL), preserving the retrieval order
    seen_urls: set[str] = set()
    sources = []
    for meta in metas:
        if not meta:
            continue
        url = meta.get("source_url") or ""
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        sources.append(
            {
                "name": meta.get("source_name") or "Unknown source",
                "title": meta.get("title") or "Untitled",
                "url": url,
            }
        )

    return {
        "question": question,
        "answer": answer,
        "sources": sources,
        "official_data": None,
    }
