"""
Tests for full-text cluster search:
  - SupabaseService.search_clusters  (mocked client)
  - GET /api/news/search             (TestClient + mocked service)

Run with the project venv:
  cd "d:\\alibaba AI\\NewsLens-\\backend"
  venv\\Scripts\\python.exe tests\\test_search.py
"""
import asyncio
import os
import sys
from unittest.mock import MagicMock, patch

# Make the backend importable when running this file directly
HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)

# Suppress noisy module-level loggers
import logging
logging.basicConfig(level=logging.WARNING)


PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    results.append((name, condition, detail))
    print(f"  {PASS if condition else FAIL}  {name}" + (f"  — {detail}" if detail and not condition else ""))


# ---------------------------------------------------------------------------
# SupabaseService.search_clusters
# ---------------------------------------------------------------------------
def build_mock_client(*, text_search_side_effect=None, data=None, count=None,
                      raise_text_search=False) -> MagicMock:
    """Build a mock Supabase client that mimics the chained call sequence used
    by `search_clusters`: select().text_search().order().range().execute().
    """
    client = MagicMock()
    table = MagicMock()
    select = MagicMock()
    text_search = MagicMock()
    order = MagicMock()
    rng = MagicMock()

    client.table.return_value = table
    table.select.return_value = select
    select.text_search.return_value = text_search
    text_search.order.return_value = order
    order.range.return_value = rng

    if raise_text_search:
        rng.execute.side_effect = text_search_side_effect or Exception("boom")
    else:
        result = MagicMock()
        result.data = data if data is not None else []
        result.count = count if count is not None else 0
        rng.execute.return_value = result
    return client


def test_service_empty_query() -> None:
    """Empty / whitespace query should return ([], 0) without touching the client."""
    from app.services.supabase_service import SupabaseService

    with patch.object(SupabaseService, "__init__", lambda self: None):
        svc = SupabaseService()
        svc.client = MagicMock()
        rows, total = asyncio.run(svc.search_clusters("", 1, 20))
        check("empty string -> empty", rows == [] and total == 0)
        rows, total = asyncio.run(svc.search_clusters("   ", 1, 20))
        check("whitespace -> empty", rows == [] and total == 0)
        svc.client.table.assert_not_called()


def test_service_none_query() -> None:
    from app.services.supabase_service import SupabaseService

    with patch.object(SupabaseService, "__init__", lambda self: None):
        svc = SupabaseService()
        svc.client = MagicMock()
        rows, total = asyncio.run(svc.search_clusters(None, 1, 20))
        check("None -> empty", rows == [] and total == 0)
        svc.client.table.assert_not_called()


def test_service_happy_path() -> None:
    from app.services.supabase_service import SupabaseService

    fake_rows = [
        {"id": "c1", "title": "Election update", "summary": "..."},
        {"id": "c2", "title": "Markets", "summary": "..."},
    ]
    client = build_mock_client(data=fake_rows, count=2)
    with patch.object(SupabaseService, "__init__", lambda self: None):
        svc = SupabaseService()
        svc.client = client
        rows, total = asyncio.run(svc.search_clusters("election", 1, 20))

    check("happy path returns rows", rows == fake_rows)
    check("happy path returns count", total == 2)
    # Verify the chain was called with the right arguments
    client.table.assert_called_once_with("clusters")
    select = client.table.return_value.select.return_value
    select.text_search.assert_called_once()
    args, kwargs = select.text_search.call_args
    check("text_search called with column name", args[0] == "search_vector")
    check("text_search called with query", args[1] == "election")
    check("text_search config=english", kwargs.get("config") == "english")
    check("text_search type=websearch", kwargs.get("type") == "websearch")


def test_service_pagination_offset() -> None:
    from app.services.supabase_service import SupabaseService

    client = build_mock_client(data=[{"id": "x"}], count=100)
    with patch.object(SupabaseService, "__init__", lambda self: None):
        svc = SupabaseService()
        svc.client = client
        asyncio.run(svc.search_clusters("foo", page=3, limit=15))

    # page=3, limit=15 -> offset = (3-1)*15 = 30, range end = 30+15-1 = 44
    order = client.table.return_value.select.return_value.text_search.return_value.order.return_value
    order.range.assert_called_once_with(30, 44)


def test_service_exception_returns_empty() -> None:
    from app.services.supabase_service import SupabaseService

    client = build_mock_client(raise_text_search=True,
                               text_search_side_effect=Exception("network error"))
    with patch.object(SupabaseService, "__init__", lambda self: None):
        svc = SupabaseService()
        svc.client = client
        rows, total = asyncio.run(svc.search_clusters("foo", 1, 20))
    check("exception -> empty rows", rows == [])
    check("exception -> zero total", total == 0)


def test_service_missing_column_returns_empty_debug() -> None:
    """If the migration hasn't been run, `search_vector` doesn't exist and
    Supabase raises a column error. The service should swallow it (debug log)
    rather than 500ing the route.
    """
    from app.services.supabase_service import SupabaseService

    client = build_mock_client(
        raise_text_search=True,
        text_search_side_effect=Exception("column 'search_vector' does not exist"),
    )
    with patch.object(SupabaseService, "__init__", lambda self: None):
        svc = SupabaseService()
        svc.client = client
        rows, total = asyncio.run(svc.search_clusters("foo", 1, 20))
    check("missing column -> empty rows", rows == [])
    check("missing column -> zero total", total == 0)


def test_service_query_stripped() -> None:
    """Leading/trailing whitespace should be stripped before the call."""
    from app.services.supabase_service import SupabaseService

    client = build_mock_client(data=[], count=0)
    with patch.object(SupabaseService, "__init__", lambda self: None):
        svc = SupabaseService()
        svc.client = client
        asyncio.run(svc.search_clusters("  hello world  ", 1, 20))

    select = client.table.return_value.select.return_value
    _, args, _ = select.text_search.mock_calls[0]
    check("query whitespace stripped", args[1] == "hello world")


# ---------------------------------------------------------------------------
# GET /api/news/search
# ---------------------------------------------------------------------------
def test_route_validation() -> None:
    """FastAPI's Query(min_length=2) should reject q shorter than 2 chars."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    r = client.get("/api/news/search")
    check("missing q -> 422", r.status_code == 422, f"got {r.status_code}")

    r = client.get("/api/news/search?q=a")
    check("q='a' (too short) -> 422", r.status_code == 422, f"got {r.status_code}")

    r = client.get("/api/news/search?q=" + "a" * 201)
    check("q > 200 chars -> 422", r.status_code == 422, f"got {r.status_code}")


def test_route_happy_path() -> None:
    """Valid q -> 200, results wired with engagement + image."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services import supabase_service as svc_mod

    fake_rows = [
        {"id": "c1", "title": "Election", "summary": "...", "category": "Politics",
         "source_count": 3, "is_breaking": False, "confidence_score": 0.8,
         "trend_score": 0.5, "published_at": "2026-01-01T00:00:00Z"},
    ]
    async def fake_search(query, page, limit):
        return fake_rows, 1
    with patch.object(svc_mod.supabase_service, "search_clusters", side_effect=fake_search), \
         patch.object(svc_mod.supabase_service, "get_engagement_counts_batch",
                      return_value={"c1": {"like_count": 5, "comment_count": 2}}), \
         patch.object(svc_mod.supabase_service, "get_representative_images",
                      return_value={"c1": "https://img.example/x.jpg"}):
        client = TestClient(app)
        r = client.get("/api/news/search?q=election")
    check("happy -> 200", r.status_code == 200, f"got {r.status_code}: {r.text[:200]}")
    body = r.json()
    check("data has 1 row", len(body["data"]) == 1)
    item = body["data"][0]
    check("row id is c1", item["id"] == "c1")
    check("row engagement wired", item["like_count"] == 5 and item["comment_count"] == 2)
    check("row image wired", item["image_url"] == "https://img.example/x.jpg")
    check("pagination total = 1", body["pagination"]["total"] == 1)


def test_route_empty_results() -> None:
    """Empty results -> 200 with data: [] (NOT 404)."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services import supabase_service as svc_mod

    async def fake_search(query, page, limit):
        return [], 0
    with patch.object(svc_mod.supabase_service, "search_clusters", side_effect=fake_search), \
         patch.object(svc_mod.supabase_service, "get_engagement_counts_batch", return_value={}), \
         patch.object(svc_mod.supabase_service, "get_representative_images", return_value={}):
        client = TestClient(app)
        r = client.get("/api/news/search?q=zzznonexistent")
    check("empty results -> 200 (not 404)", r.status_code == 200, f"got {r.status_code}")
    body = r.json()
    check("empty results data: []", body["data"] == [])
    check("empty results total = 0", body["pagination"]["total"] == 0)


def test_route_passes_page_limit() -> None:
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services import supabase_service as svc_mod

    seen: dict = {}
    async def fake_search(query, page, limit):
        seen["query"] = query
        seen["page"] = page
        seen["limit"] = limit
        return [], 0
    with patch.object(svc_mod.supabase_service, "search_clusters", side_effect=fake_search), \
         patch.object(svc_mod.supabase_service, "get_engagement_counts_batch", return_value={}), \
         patch.object(svc_mod.supabase_service, "get_representative_images", return_value={}):
        client = TestClient(app)
        r = client.get("/api/news/search?q=foo&page=4&limit=10")
    check("page passed", seen.get("page") == 4)
    check("limit passed", seen.get("limit") == 10)
    check("query passed", seen.get("query") == "foo")


def test_route_q_is_stripped() -> None:
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services import supabase_service as svc_mod

    seen: dict = {}
    async def fake_search(query, page, limit):
        seen["query"] = query
        return [], 0
    with patch.object(svc_mod.supabase_service, "search_clusters", side_effect=fake_search), \
         patch.object(svc_mod.supabase_service, "get_engagement_counts_batch", return_value={}), \
         patch.object(svc_mod.supabase_service, "get_representative_images", return_value={}):
        client = TestClient(app)
        r = client.get("/api/news/search?q=%20%20hello%20%20")  # "  hello  "
    check("query trimmed in route", seen.get("query") == "hello")


def test_route_search_before_cluster_id() -> None:
    """Critical: /api/news/search must NOT be matched by the /{cluster_id} path
    param. If it were, the user would get a 404 from get_cluster_by_id.
    """
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services import supabase_service as svc_mod

    async def fake_search(query, page, limit):
        return [], 0
    # If routing is wrong, get_cluster_by_id would be called with "search" and 404.
    with patch.object(svc_mod.supabase_service, "search_clusters", side_effect=fake_search), \
         patch.object(svc_mod.supabase_service, "get_cluster_by_id", return_value=None) as mock_gcbi, \
         patch.object(svc_mod.supabase_service, "get_engagement_counts_batch", return_value={}), \
         patch.object(svc_mod.supabase_service, "get_representative_images", return_value={}):
        client = TestClient(app)
        r = client.get("/api/news/search?q=anything")
    check("routed to search, not cluster lookup", r.status_code == 200)
    check("get_cluster_by_id NOT called", mock_gcbi.call_count == 0)


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------
def main() -> int:
    print("=" * 70)
    print("Service: SupabaseService.search_clusters")
    print("=" * 70)
    test_service_empty_query()
    test_service_none_query()
    test_service_happy_path()
    test_service_pagination_offset()
    test_service_exception_returns_empty()
    test_service_missing_column_returns_empty_debug()
    test_service_query_stripped()

    print()
    print("=" * 70)
    print("Route: GET /api/news/search")
    print("=" * 70)
    test_route_validation()
    test_route_happy_path()
    test_route_empty_results()
    test_route_passes_page_limit()
    test_route_q_is_stripped()
    test_route_search_before_cluster_id()

    print()
    print("=" * 70)
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = total - passed
    print(f"RESULT: {passed}/{total} passed, {failed} failed")
    print("=" * 70)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
