"""Scout Agent — Fetches news from RSS feeds."""

import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Any

import feedparser
import requests

from app.models.sources import FEED_SOURCES
from app.config import get_settings

FEED_TIMEOUT = 10  # seconds per feed

# First <img src="..."> in HTML (used as last-resort fallback for og:image etc.)
_IMG_SRC_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)

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
        """Fetch and parse a single RSS feed with timeout."""
        try:
            response = requests.get(
                feed_config["url"],
                timeout=FEED_TIMEOUT,
                headers={"User-Agent": "NewsLens/0.2 (News Aggregator)"},
            )
            response.raise_for_status()
            feed = feedparser.parse(response.content)
        except requests.exceptions.Timeout:
            logger.warning(f"  {feed_config['name']}: timed out after {FEED_TIMEOUT}s")
            return []
        except requests.exceptions.RequestException as e:
            logger.warning(f"  {feed_config['name']}: request failed - {e}")
            return []
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
                "image_url": self._extract_image_url(entry),
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

    def _extract_image_url(self, entry) -> str | None:
        """Extract a thumbnail image URL from a feed entry.
        Tries Media RSS, RSS enclosures, RSS <image>, then <img> in content.
        Returns None when no usable image is found.
        """
        candidate: Any = None

        # 1) Media RSS <media:content> — most common for modern feeds
        media_content = getattr(entry, "media_content", None) or []
        for m in media_content:
            url = m.get("url") if isinstance(m, dict) else None
            mime = (m.get("type") or "").lower() if isinstance(m, dict) else ""
            if url and (not mime or mime.startswith("image/")):
                candidate = url
                break

        # 2) Media RSS <media:thumbnail>
        if not candidate:
            thumbs = getattr(entry, "media_thumbnail", None) or []
            if thumbs and isinstance(thumbs[0], dict):
                candidate = thumbs[0].get("url")

        # 3) RSS 2.0 <enclosure> with image/* type
        if not candidate:
            enclosures = getattr(entry, "enclosures", None) or []
            for enc in enclosures:
                if not isinstance(enc, dict):
                    continue
                enc_type = (enc.get("type") or "").lower()
                enc_url = enc.get("href") or enc.get("url")
                if enc_url and enc_type.startswith("image/"):
                    candidate = enc_url
                    break

        # 4) Last resort: first <img src="..."> inside content or summary HTML
        if not candidate:
            html = ""
            if getattr(entry, "content", None):
                html = entry.content[0].get("value", "")
            if not html and getattr(entry, "summary", None):
                html = entry.summary
            if html:
                match = _IMG_SRC_RE.search(html)
                if match:
                    candidate = match.group(1)

        if not candidate or not isinstance(candidate, str):
            return None
        # Only accept absolute http(s) URLs — skip data: URIs and relative paths
        if not (candidate.startswith("http://") or candidate.startswith("https://")):
            return None
        return candidate

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

    def _is_too_old(self, published: datetime, max_hours: int = 72) -> bool:
        """Check if an article is older than max_hours."""
        now = datetime.now(timezone.utc)
        diff = now - published
        return diff.total_seconds() > max_hours * 3600
