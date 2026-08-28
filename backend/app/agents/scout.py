"""Scout Agent — Fetches news from RSS feeds."""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Any

import feedparser

from app.models.sources import FEED_SOURCES
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ScoutAgent:
    """
    Fetches articles from configured RSS feeds.
    Filters by recency and deduplicates by URL.
    """

    def __init__(self):
        self.seen_urls: set = set()
        self.feeds = [f for f in FEED_SOURCES if f["priority"] <= 1]
        logger.info(f"Scout Agent initialized with {len(self.feeds)} feeds")

    async def fetch_all(self) -> List[Dict[str, Any]]:
        """Fetch new articles from all configured RSS feeds."""
        all_articles = []
        for feed_config in self.feeds:
            try:
                articles = await self._fetch_feed(feed_config)
                all_articles.extend(articles)
                logger.info(f"  {feed_config['name']}: {len(articles)} new articles")
            except Exception as e:
                logger.error(f"  {feed_config['name']}: FAILED - {e}")
        logger.info(f"Scout Agent: {len(all_articles)} total new articles fetched")
        return all_articles

    async def _fetch_feed(self, feed_config: Dict) -> List[Dict[str, Any]]:
        """Fetch and parse a single RSS feed."""
        feed = feedparser.parse(feed_config["url"])
        articles = []

        for entry in feed.entries[:settings.max_articles_per_feed]:
            url = entry.get("link", "")
            if url in self.seen_urls:
                continue

            # Skip old articles (older than 24 hours)
            published = self._parse_date(entry)
            if published and self._is_too_old(published):
                continue

            article = {
                "source_name": feed_config["name"],
                "source_url": url,
                "title": entry.get("title", "").strip(),
                "content": self._extract_content(entry),
                "published_at": published.isoformat() if published else None,
                "language": feed_config.get("language", "en"),
            }

            if article["title"]:
                self.seen_urls.add(url)
                articles.append(article)

        return articles

    def _extract_content(self, entry) -> str:
        """Extract the best available content from a feed entry."""
        # Try content field first (full article), then summary
        if hasattr(entry, "content") and entry.content:
            return entry.content[0].get("value", "")[:2000]
        if hasattr(entry, "summary"):
            return entry.summary[:2000]
        if hasattr(entry, "description"):
            return entry.description[:2000]
        return ""

    def _parse_date(self, entry) -> datetime | None:
        """Parse published date from feed entry."""
        for date_field in ["published_parsed", "updated_parsed"]:
            parsed = getattr(entry, date_field, None)
            if parsed:
                try:
                    from time import mktime
                    return datetime.fromtimestamp(mktime(parsed), tz=timezone.utc)
                except Exception:
                    pass
        return None

    def _is_too_old(self, published: datetime, max_hours: int = 24) -> bool:
        """Check if an article is older than max_hours."""
        now = datetime.now(timezone.utc)
        diff = now - published
        return diff.total_seconds() > max_hours * 3600
